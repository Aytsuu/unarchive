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
