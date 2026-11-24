import { strict as assert } from "node:assert"
import { test } from "node:test"
import { LISTING_SORT_OPTIONS, LISTING_SORTS, listingMatch, listingSortNeedsMetrics, listingSortSpec, parseListingParams } from "../apps/web/lib/projects/listing-params.mjs"

test("guest browsing accepts pagination and supported page sizes", () => {
  assert.deepEqual(parseListingParams(new URLSearchParams("q=%20Example%20&page=4&size=12")), {
    search: "Example", page: 4, pageSize: 12, sort: "", yearFrom: null, yearTo: null, institutions: [],
  })
})

test("pagination accepts supported sizes and rejects invalid pages", () => {
  assert.deepEqual(parseListingParams(new URLSearchParams("page=4&size=12")), {
    search: "", page: 4, pageSize: 12, sort: "", yearFrom: null, yearTo: null, institutions: [],
  })
  for (const page of ["-1", "Infinity", "1.5", "9999999999999999999999"]) {
    assert.equal(parseListingParams(new URLSearchParams({ page, size: "200" })).page, 1)
    assert.equal(parseListingParams(new URLSearchParams({ page, size: "200" })).pageSize, 3)
  }
  assert.equal(parseListingParams(new URLSearchParams({ q: "a".repeat(120) })).search.length, 100)
})

test("parses sort, completion years, and institutions for advanced filters", () => {
  const parsed = parseListingParams(new URLSearchParams("sort=stars-desc&from=2019&to=2024&institution=Harborview+University&institution=Eastport+University&institution=Harborview+University"))
  assert.equal(parsed.sort, "stars-desc")
  assert.equal(parsed.yearFrom, 2019)
  assert.equal(parsed.yearTo, 2024)
  assert.deepEqual(parsed.institutions, ["Harborview University", "Eastport University"])
})

test("drops inverted completion years and unknown sorts", () => {
  const parsed = parseListingParams(new URLSearchParams("sort=popular&from=2024&to=2020&from=0000"))
  assert.equal(parsed.sort, "")
  assert.equal(parsed.yearFrom, null)
  assert.equal(parsed.yearTo, null)
  for (const sort of LISTING_SORTS) assert.equal(parseListingParams(new URLSearchParams({ sort })).sort, sort)
})

test("allows equal completion years", () => {
  const parsed = parseListingParams(new URLSearchParams("from=2020&to=2020"))
  assert.equal(parsed.yearFrom, 2020)
  assert.equal(parsed.yearTo, 2020)
})

test("sort specs cover metric and title orders", () => {
  assert.equal(listingSortNeedsMetrics("stars-desc"), true)
  assert.equal(listingSortNeedsMetrics("views-asc"), true)
  assert.equal(listingSortNeedsMetrics("az"), false)
  assert.deepEqual(listingSortSpec("az"), { title: 1, _id: 1 })
  assert.deepEqual(listingSortSpec("oldest"), { createdAt: 1, _id: 1 })
  assert.deepEqual(listingSortSpec("recent"), { createdAt: -1, _id: -1 })
  assert.deepEqual(LISTING_SORT_OPTIONS.map((option) => option.label), [
    "A-Z", "Highest stars", "Highest reads", "Lowest stars", "Lowest reads", "Most recent", "Oldest",
  ])
})

test("listing match applies topic, institutions, escaped title, and completion year", () => {
  assert.deepEqual(listingMatch({ search: "" }), { withdrawnAt: { $exists: false } })
  const filter = listingMatch({
    search: "flood.map",
    topic: "AI & Data Science",
    yearFrom: 2020,
    yearTo: 2024,
    institutions: ["Harborview University", "Eastport University"],
  })
  assert.equal(filter.withdrawnAt.$exists, false)
  assert.equal(filter.$and[0].title.$regex, "flood\\.map")
  assert.equal(filter.$and[1].topics, "AI & Data Science")
  assert.deepEqual(filter.$and[2].institution.$in, ["Harborview University", "Eastport University"])
  assert.equal(filter.$and[3].$expr.$and[1].$gte[1], 2020)
  assert.equal(filter.$and[3].$expr.$and[2].$lte[1], 2024)
})
