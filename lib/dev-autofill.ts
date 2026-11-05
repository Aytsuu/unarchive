import "server-only"
import { lstat, readFile } from "node:fs/promises"
import { basename, extname, join } from "node:path"

const DATA_DIRECTORY = join(process.cwd(), "dev-data")
const IMAGE_DIRECTORY = join(DATA_DIRECTORY, "images")
const MAX_IMAGE_BYTES = 5 * 1024 * 1024
const MAX_CONFIG_BYTES = 1024 * 1024

export function isLocalDevelopmentRequest(request: Request) {
  if (process.env.NODE_ENV !== "development") return false
  try {
    const url = new URL(request.url)
    if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return false
    const origin = request.headers.get("origin")
    const site = request.headers.get("sec-fetch-site")
    return (!origin || origin === url.origin) && (!site || site === "same-origin" || site === "none")
  } catch { return false }
}

function validImageName(name: string) {
  return /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(name) && !name.includes("..") && basename(name) === name && [".png", ".jpg", ".jpeg"].includes(extname(name).toLowerCase())
}

export async function readAutofillConfig() {
  let path = join(DATA_DIRECTORY, "autofill.local.json")
  let stat
  try { stat = await lstat(path) } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error
    path = join(DATA_DIRECTORY, "autofill.json")
    stat = await lstat(path)
  }
  if (!stat.isFile() || stat.size > MAX_CONFIG_BYTES) throw new Error("Invalid autofill configuration")
  const parsed: unknown = JSON.parse(await readFile(path, "utf8"))
  if (!parsed || typeof parsed !== "object" || !("fields" in parsed) || !parsed.fields || typeof parsed.fields !== "object" || Array.isArray(parsed.fields)) throw new Error("Invalid autofill configuration")
  const fields: Record<string, string | boolean | string[]> = {}
  for (const [key, value] of Object.entries(parsed.fields)) {
    if (typeof value === "string" || typeof value === "boolean" || (Array.isArray(value) && value.length <= 50 && value.every((item) => typeof item === "string"))) fields[key] = value
  }
  const imageNames = "images" in parsed && Array.isArray(parsed.images) ? parsed.images.filter((name): name is string => typeof name === "string" && validImageName(name)).slice(0, 5) : []
  return { fields, images: imageNames.map((name) => ({ name, type: extname(name).toLowerCase() === ".png" ? "image/png" : "image/jpeg", url: `/api/dev/autofill/image/${encodeURIComponent(name)}` })) }
}

export async function readAutofillImage(name: string) {
  if (!validImageName(name)) return null
  const path = join(IMAGE_DIRECTORY, name)
  const stat = await lstat(path).catch(() => null)
  if (!stat?.isFile() || stat.isSymbolicLink() || stat.size > MAX_IMAGE_BYTES || stat.size === 0) return null
  const bytes = await readFile(path)
  const png = bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  const isPng = extname(name).toLowerCase() === ".png"
  if ((isPng && !png) || (!isPng && !jpeg)) return null
  return { bytes, type: isPng ? "image/png" : "image/jpeg" }
}
