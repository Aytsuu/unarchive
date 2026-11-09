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
    await projects.insertOne({ ownerId: "test-owner", title: "Test project", description: "Description", abstract: "Project abstract", topics: ["AI & Data Science", "Health & Medicine"], links: ["https://example.com"], demos: ["demo-key"], institution: "Test institution", dateStarted: "2022-01", dateEnded: "2023-12", contributors: ["Test contributor"], consents: { permission: true, contributorsPermission: true }, createdAt: now, updatedAt: now })
    await assert.rejects(projects.updateOne({ title: "Test project" }, { $set: { "consents.detailsAccurate": "yes" } }), /validation/i)
    await projects.updateOne({ title: "Test project" }, { $set: { "consents.detailsAccurate": true } })
    await assert.rejects(projects.insertOne({ ownerId: "test-owner", title: "Bad abstract", abstract: 123, createdAt: now, updatedAt: now }), /validation/i)
    await assert.rejects(projects.insertOne({ ownerId: "test-owner", title: "Long abstract", abstract: "a".repeat(10001), createdAt: now, updatedAt: now }), /validation/i)
    await assert.rejects(projects.insertOne({ ownerId: "test-owner", title: "Invalid month", dateStarted: "2024-13", createdAt: now, updatedAt: now }), /validation/i)
    await assert.rejects(projects.insertOne({ ownerId: "test-owner", title: "Invalid date", dateEnded: "2024-01-01", createdAt: now, updatedAt: now }), /validation/i)
    await assert.rejects(projects.insertOne({ ownerId: "test-owner", title: "Unknown topic", topics: ["unknown"], createdAt: now, updatedAt: now }), /validation/i)
    await assert.rejects(projects.insertOne({ ownerId: "test-owner", title: "Duplicate topics", topics: ["AI & Data Science", "AI & Data Science"], createdAt: now, updatedAt: now }), /validation/i)
    await assert.rejects(projects.insertOne({ ownerId: "test-owner", title: "Bad reference", referenceProjectIds: ["invalid"], createdAt: now, updatedAt: now }), /validation/i)
    await assert.rejects(projects.insertOne({ ownerId: "test-owner", title: "Duplicate references", referenceProjectIds: ["abcdef0123456789abcdef01", "abcdef0123456789abcdef01"], createdAt: now, updatedAt: now }), /validation/i)
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
