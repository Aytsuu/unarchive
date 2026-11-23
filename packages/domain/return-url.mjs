import { readFileSync } from "node:fs"
import { join } from "node:path"

function configuredOrigin(value) {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    const url = new URL(value)
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return null
    return url.origin
  } catch {
    return null
  }
}

export function moderatorAppUrl(env = process.env, cwd = process.cwd()) {
  const configured = configuredOrigin(env.MODERATOR_APP_URL)
  if (configured) return configured
  if (env.NODE_ENV === "production") return ""
  try {
    const ports = JSON.parse(readFileSync(join(cwd, ".stack", "ports.json"), "utf8"))
    const port = Number(ports.moderator)
    if (Number.isInteger(port) && port >= 3100 && port <= 3199) return `http://localhost:${port}`
  } catch {
    // The stack file is written when the dev servers start.
  }
  return "http://localhost:3100"
}

export function safeModeratorReturn(candidate, allowedOrigin) {
  const allowed = configuredOrigin(allowedOrigin)
  if (!allowed || typeof candidate !== "string" || !candidate.trim()) return null
  let url
  try { url = new URL(candidate) } catch { return null }
  if (url.origin !== allowed || url.username || url.password) return null
  if (url.protocol !== "http:" && url.protocol !== "https:") return null
  return `${url.origin}${url.pathname}${url.search}`
}

export function loginRedirectForModerator(webOrigin, moderatorOrigin) {
  const web = configuredOrigin(webOrigin)
  let destination = null
  try { destination = safeModeratorReturn(new URL("/", moderatorOrigin).href, moderatorOrigin) } catch { destination = null }
  if (!web || !destination) throw new Error("The moderator return destination is not valid.")
  return `${web}/login?next=${encodeURIComponent(destination)}`
}
