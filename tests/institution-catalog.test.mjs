import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const directory = new URL("../public/data/", import.meta.url)
const catalog = JSON.parse(await readFile(new URL("philippine-institutions.json", directory), "utf8"))
test("directory records retain unique identifiers and have bounded valid institution names", () => {
  assert.ok(catalog.length > 2000)
  assert.equal(new Set(catalog.map((item) => item.id)).size, catalog.length)
  assert.ok(catalog.every((item) => item.name && item.name.length <= 200 && item.region && item.id.startsWith("ched-")))
})
