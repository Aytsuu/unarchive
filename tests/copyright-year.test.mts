import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

test("copyright year is produced inside a cached helper", async () => {
  const source = await readFile(fileURLToPath(new URL("../lib/landing/copyright-year.ts", import.meta.url)), "utf8")
  assert.match(source, /"use cache"/)
  assert.match(source, /cacheLife\(/)
  assert.match(source, /new Date\(\)\.getFullYear\(\)/)
})

test("landing footer does not read the current time during render", async () => {
  const source = await readFile(fileURLToPath(new URL("../components/landing/landing-footer.tsx", import.meta.url)), "utf8")
  assert.equal(/\bnew Date\s*\(/.test(source), false)
  assert.match(source, /copyrightYear/)
})
