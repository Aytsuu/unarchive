import { strict as assert } from "node:assert"
import { test } from "node:test"
import { pageSizeForWidth, listingQueryForViewport } from "../lib/projects/listing-viewport.mjs"

test("viewport matches the grid breakpoints", () => {
  for (const [width, expected] of [[320, 3], [639, 3], [640, 6], [1023, 6], [1024, 9], [1279, 9], [1280, 12]]) assert.equal(pageSizeForWidth(width), expected)
})

test("queries use the viewport immediately and reset pagination on a size change", () => {
  assert.deepEqual(listingQueryForViewport(1280, 1, 3), { page: 1, pageSize: 12 })
  assert.deepEqual(listingQueryForViewport(1280, 2, 12), { page: 2, pageSize: 12 })
  assert.deepEqual(listingQueryForViewport(700, 4, 12), { page: 1, pageSize: 6 })
  assert.deepEqual(listingQueryForViewport(1280, 4, 12), { page: 4, pageSize: 12 })
  assert.equal(listingQueryForViewport(null, 1, 3), null)
})
