import { strict as assert } from "node:assert"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { MongoClient } from "mongodb"
const { parseReferenceQuery, searchReferenceProjects, claimReferenceSearch } = await import(new URL("../lib/projects/reference-search.ts", import.meta.url).href)

test("reference search validates and escapes user queries", () => {
  assert.equal(parseReferenceQuery("  Example  "), "Example")
  assert.equal(parseReferenceQuery(null), "")
  assert.equal(parseReferenceQuery("x".repeat(101)), null)
  assert.equal(parseReferenceQuery("bad\0input"), null)
})

test("project lookup limits results, searches literal titles, and rate limits per account", async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required")
  const client = new MongoClient(process.env.MONGODB_URI)
  await client.connect()
  const db = client.db(`reference_search_test_${randomUUID().replaceAll("-", "")}`)
  try {
    await db.collection("projects").insertMany([
      ...Array.from({ length: 22 }, (_, index) => ({ title: `Project ${index}`, createdAt: new Date(2024, 0, index + 1), privateValue: "not exposed" })),
      { title: "Literal [example]", createdAt: new Date(2025, 0, 1), privateValue: "not exposed" },
      { title: "Withdrawn [example]", withdrawnAt: new Date(), createdAt: new Date(2026, 0, 1) },
    ])
    const results = await searchReferenceProjects(db, "")
    assert.equal(results.length, 20)
    assert.deepEqual(Object.keys(results[0]).sort(), ["id", "title"])
    const literal = await searchReferenceProjects(db, "[example]")
    assert.equal(literal.length, 1)
    assert.equal(literal[0].title, "Literal [example]")
    assert.deepEqual(await searchReferenceProjects(db, "Withdrawn"), [])
    const attempts = await Promise.all(Array.from({ length: 121 }, () => claimReferenceSearch(db, "account-a")))
    assert.equal(attempts.filter(Boolean).length, 1)
    assert.equal(await claimReferenceSearch(db, "account-b"), 0)
  } finally {
    await db.dropDatabase()
    await client.close()
  }
})
