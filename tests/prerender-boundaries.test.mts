import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { join } from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const runtimeCall = /\b(?:headers|cookies|connection)\s*\(/
const asyncDefault = /export\s+default\s+async\s+function/

async function pageFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return pageFiles(path)
    return entry.name === "page.tsx" ? [path] : []
  }))
  return nested.flat()
}

test("pages that read request data keep that work out of an async default export", async () => {
  const appDir = fileURLToPath(new URL("../app", import.meta.url))
  const files = await pageFiles(appDir)
  const blocking = []
  for (const file of files) {
    const source = await readFile(file, "utf8")
    if (runtimeCall.test(source) && asyncDefault.test(source)) blocking.push(file.slice(appDir.length + 1).replaceAll("\\", "/"))
  }
  assert.deepEqual(blocking, [])
})

test("pages that read a session wait for the request before auth can read the current time", async () => {
  const appDir = fileURLToPath(new URL("../app", import.meta.url))
  const files = await pageFiles(appDir)
  const missing = []
  for (const file of files) {
    const source = await readFile(file, "utf8")
    if (source.includes("getSession") && !/\bconnection\s*\(/.test(source)) missing.push(file.slice(appDir.length + 1).replaceAll("\\", "/"))
  }
  assert.deepEqual(missing, [])
})
