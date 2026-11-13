import { strict as assert } from "node:assert"
import { test } from "node:test"
import { parseListingParams } from "../lib/projects/listing-params.mjs"

test("guest browsing accepts pagination and supported page sizes", () => {
  assert.deepEqual(parseListingParams(new URLSearchParams("q=%20Example%20&page=4&size=12")), { search: "Example", page: 4, pageSize: 12 })
})

test("pagination accepts supported sizes and rejects invalid pages", () => {
  assert.deepEqual(parseListingParams(new URLSearchParams("page=4&size=12")), { search: "", page: 4, pageSize: 12 })
  for (const page of ["-1", "Infinity", "1.5", "9999999999999999999999"]) {
    assert.equal(parseListingParams(new URLSearchParams({ page, size: "200" })).page, 1)
    assert.equal(parseListingParams(new URLSearchParams({ page, size: "200" })).pageSize, 3)
  }
  assert.equal(parseListingParams(new URLSearchParams({ q: "a".repeat(120) })).search.length, 100)
})
