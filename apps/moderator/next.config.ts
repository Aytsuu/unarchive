import { existsSync, readFileSync } from "node:fs"
import path from "node:path"
import type { NextConfig } from "next"

function loadLocalEnv() {
  const candidates = [path.resolve(process.cwd(), ".env.local"), path.resolve(process.cwd(), "../../.env.local")]
  const file = candidates.find((candidate) => existsSync(candidate))
  if (!file) return
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    if (/^\s*#/.test(line)) continue
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || process.env[match[1]]) continue
    let value = match[2]
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1)
    process.env[match[1]] = value
  }
}

loadLocalEnv()

const repoRoot = existsSync(path.resolve(process.cwd(), "package-lock.json")) ? process.cwd() : path.resolve(process.cwd(), "../..")

const nextConfig: NextConfig = {
  transpilePackages: ["@unarchive/domain", "@unarchive/server"],
  cacheComponents: true,
  partialPrefetching: true,
  async rewrites() {
    const web = (process.env.WEB_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000").replace(/\/$/, "")
    return [
      { source: "/assets/:path*", destination: `${web}/assets/:path*` },
      { source: "/api/notifications", destination: `${web}/api/notifications` },
      { source: "/api/notifications/:path*", destination: `${web}/api/notifications/:path*` },
      { source: "/api/auth/:path*", destination: `${web}/api/auth/:path*` },
    ]
  },
  turbopack: {
    root: repoRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
