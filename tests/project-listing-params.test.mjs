import { strict as assert } from "node:assert"
import { test } from "node:test"
import { parseListingParams } from "../lib/projects/listing-params.mjs"

test("guest preview ignores pagination and size overrides", () => {
  assert.deepEqual(parseListingParams(new URLSearchParams("q=%20Example%20&page=4&size=12"), false), { search: "Example", page: 1, pageSize: 3 })
})

test("signed-in pagination accepts supported sizes and rejects invalid pages", () => {
  assert.deepEqual(parseListingParams(new URLSearchParams("page=4&size=12"), true), { search: "", page: 4, pageSize: 12 })
  for (const page of ["-1", "Infinity", "1.5", "9999999999999999999999"]) {
    assert.equal(parseListingParams(new URLSearchParams({ page, size: "200" }), true).page, 1)
    assert.equal(parseListingParams(new URLSearchParams({ page, size: "200" }), true).pageSize, 3)
  }
  assert.equal(parseListingParams(new URLSearchParams({ q: "a".repeat(120) }), true).search.length, 100)
})
