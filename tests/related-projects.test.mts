import assert from "node:assert/strict"
import { test } from "node:test"
const { relatedProjectCards, relatedProjectIds, citedByMatch } = await import(new URL("../lib/projects/related-projects.ts", import.meta.url).href)

const first = "abcdef0123456789abcdef01"
const second = "abcdef0123456789abcdef02"
const third = "abcdef0123456789abcdef03"

test("related cards keep requested order with title, description, and a details path", () => {
  const cards = relatedProjectCards([second.toUpperCase(), first, "not-an-id", second], [
    { _id: first, title: "First project", description: " Alpha summary " },
    { _id: { toHexString: () => second }, title: "Second project" },
    { _id: third, title: "Withdrawn", description: "Hidden", withdrawnAt: new Date("2026-01-01") },
  ])
  assert.deepEqual(cards, [
    { id: second, title: "Second project", description: "", href: `/projects/${second}` },
    { id: first, title: "First project", description: "Alpha summary", href: `/projects/${first}` },
  ])
})

test("related cards skip missing, untitled, and withdrawn records", () => {
  assert.deepEqual(relatedProjectCards([first, second, third], [
    { _id: first, title: "   ", description: "Kept if titled" },
    { _id: third, title: "Gone", withdrawnAt: new Date() },
  ]), [])
})

test("related ids prefer snapshot reference order over live ids", () => {
  assert.deepEqual(relatedProjectIds({
    references: [{ id: second }, { id: first }],
    referenceProjectIds: [first, third],
  }), [second, first])
  assert.deepEqual(relatedProjectIds({ referenceProjectIds: [first] }), [first])
  assert.deepEqual(relatedProjectIds({}), [])
})

test("cited-by match finds public projects that list this id as a reference", () => {
  assert.deepEqual(citedByMatch(first.toUpperCase()), {
    referenceProjectIds: first,
    withdrawnAt: { $exists: false },
  })
  assert.equal(citedByMatch("bad"), null)
})
