import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { MongoClient } from "mongodb"
const { getProjectStatistics } = await import(new URL("../lib/projects/statistics.ts", import.meta.url).href)

test("statistics group institutions by normalized name and count all published projects", async () => {
  if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required")
  const client = new MongoClient(process.env.MONGODB_URI, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const db = client.db(`project_statistics_test_${randomUUID().replaceAll("-", "")}`)
  try {
    await client.connect()
    const now = new Date("2026-11-15T12:00:00.000Z")
    assert.deepEqual(await getProjectStatistics(db, now), { totalProjects: 0, institutions: [], topics: [], publishers: { monthly: [], annually: [] } })
    await db.collection("user").insertMany([{ _id: "owner-a" as never, name: "Alice" }, { _id: "owner-b" as never, name: "Ben" }])
    await db.collection("projects").insertMany([
      { institution: "Northfield University", ownerId: "owner-a", createdAt: new Date("2026-11-01T00:00:00Z"), topics: ["Health", "Health", "Education"] },
      { institution: " northfield university ", ownerId: "owner-a", createdAt: new Date("2026-11-14T00:00:00Z"), topics: ["Health"] },
      { institution: "South College", ownerId: "owner-b", createdAt: new Date("2026-01-02T00:00:00Z"), topics: ["Education"] },
      { institution: "  ", ownerId: "owner-b", createdAt: new Date("2025-12-31T23:59:59Z") },
      { institution: null, ownerId: "owner-b", createdAt: new Date("2026-12-01T00:00:00Z") },
      {},
      { institution: "Withdrawn University", topics: ["Health"], withdrawnAt: new Date(), createdAt: new Date("2026-11-01T00:00:00Z") },
    ])
    const result = await getProjectStatistics(db, now)
    assert.equal(result.totalProjects, 6)
    assert.equal(result.institutions.length, 2)
    assert.equal(result.institutions[0].name.toLowerCase(), "northfield university")
    assert.equal(result.institutions[0].count, 2)
    assert.deepEqual(result.institutions[1], { name: "South College", count: 1 })
    assert.deepEqual(result.topics, [{ name: "Education", count: 2 }, { name: "Health", count: 2 }])
    assert.deepEqual(result.publishers.monthly, [{ id: "owner-a", name: "Alice", count: 2 }])
    assert.deepEqual(result.publishers.annually, [{ id: "owner-a", name: "Alice", count: 2 }, { id: "owner-b", name: "Ben", count: 2 }])
  } finally {
    await db.dropDatabase()
    await client.close()
  }
})
