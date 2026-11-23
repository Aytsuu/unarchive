import { existsSync, readFileSync, realpathSync } from "node:fs"
import path from "node:path"
import type { NextConfig } from "next"

const workspaceRoot = path.resolve(process.cwd(), "../..")

function loadLocalEnv() {
  const file = path.join(workspaceRoot, ".env.local")
  if (!existsSync(file)) return
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

/** Orca shares node_modules through a junction that can point outside this worktree. */
function linkedNodeModulesRoot(): string | undefined {
  const nodeModulesPath = path.join(workspaceRoot, "node_modules")
  try {
    const realNodeModules = path.resolve(realpathSync(nodeModulesPath))
    const relative = path.relative(workspaceRoot, realNodeModules)
    if (relative.startsWith("..") || path.isAbsolute(relative)) return path.dirname(realNodeModules)
  } catch {
    return undefined
  }
  return undefined
}

const linkedNodeModules = linkedNodeModulesRoot()

const nextConfig: NextConfig = {
  transpilePackages: ["@unarchive/domain", "@unarchive/server"],
  experimental: {
    agentFeedback: true,
    ...(linkedNodeModules
      ? { turbopackAdditionalRoots: { "linked-modules": { path: linkedNodeModules } } }
      : {}),
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    root: workspaceRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
}

export default nextConfig
