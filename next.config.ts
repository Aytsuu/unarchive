import { realpathSync } from "node:fs"
import path from "node:path"
import type { NextConfig } from "next"

const projectRoot = process.cwd()
const nodeModulesPath = path.join(projectRoot, "node_modules")

/** Orca shares node_modules through a junction that can point outside this worktree. */
function linkedNodeModulesRoot(): string | undefined {
  try {
    const realNodeModules = path.resolve(realpathSync(nodeModulesPath))
    const relative = path.relative(projectRoot, realNodeModules)
    if (relative.startsWith("..") || path.isAbsolute(relative)) return path.dirname(realNodeModules)
  } catch {
    return undefined
  }
  return undefined
}

const linkedNodeModules = linkedNodeModulesRoot()

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    agentFeedback: true,
    ...(linkedNodeModules
      ? { turbopackAdditionalRoots: { "linked-modules": { path: linkedNodeModules } } }
      : {}),
  },
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
