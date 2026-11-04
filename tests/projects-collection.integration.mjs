import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { MongoClient } from "mongodb"
import { initializeProjectsCollection } from "../scripts/init-projects.mjs"
import { validateLocalTarget } from "../scripts/reset-auth.mjs"

test("projects initialization creates a validated collection and is safe to repeat", async () => {
  const client = new MongoClient(process.env.MONGODB_URI, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const name = `projects_test_${randomUUID().replaceAll("-", "")}`
  validateLocalTarget(process.env.MONGODB_URI, name)
  try {
    await client.connect()
    const db = client.db(name)
    assert.equal(await initializeProjectsCollection(db), true)
    const projects = db.collection("projects")
    const now = new Date()
    await assert.rejects(projects.insertOne({ title: "Missing owner" }), /validation/i)
    await projects.insertOne({ ownerId: "test-owner", title: "Test project", description: "Description", links: ["https://example.com"], demos: ["demo-key"], institution: "Test institution", contributors: ["Test contributor"], consents: { permission: true, contributorsPermission: true }, createdAt: now, updatedAt: now })
    assert.equal(await initializeProjectsCollection(db), false)
    assert.equal(await projects.countDocuments(), 1)
    const indexes = await projects.indexes()
    assert.ok(indexes.some(({ key }) => key.ownerId === 1 && key.createdAt === -1))
    assert.ok(indexes.some(({ key }) => key.createdAt === -1 && Object.keys(key).length === 1))
  } finally {
    await client.db(name).dropDatabase()
    await client.close()
  }
})
