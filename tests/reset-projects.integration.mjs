import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { MongoClient, ObjectId } from "mongodb"
import { initializeProjectsCollection } from "../scripts/init-projects.mjs"
import { validateLocalTarget } from "../scripts/reset-auth.mjs"
import { resetProjectData } from "../scripts/reset-projects.mjs"

const uri = process.env.MONGODB_URI

test("project reset removes related records, preserves other data and can be repeated", { skip: !uri && "MONGODB_URI is required" }, async () => {
  const name = `projects_reset_test_${randomUUID().replaceAll("-", "")}`
  validateLocalTarget(uri, name)
  const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  let connected = false
  try {
    await client.connect()
    connected = true
    const db = client.db(name)
    await initializeProjectsCollection(db)
    const projects = db.collection("projects")
    const firstId = new ObjectId()
    const secondId = new ObjectId()
    const now = new Date()
    await projects.insertMany([
      { _id: firstId, ownerId: "user-1", title: "First project", idempotencyDigest: "test-digest", demos: ["projects/11111111-1111-4111-8111-111111111111.png"], createdAt: now, updatedAt: now },
      { _id: secondId, ownerId: "user-1", title: "Second project", referenceProjectIds: [firstId.toHexString()], createdAt: now, updatedAt: now },
    ])
    await db.collection("projectViews").insertMany([{ projectId: firstId }, { projectId: secondId }])
    await db.collection("projectStars").insertMany([{ projectId: firstId }, { projectId: secondId }])
    for (const collectionName of ["user", "session", "account", "verification", "projectPublishRateLimit", "projectMetricsRateLimit", "projectReferenceSearchRateLimit", "unrelated"]) {
      await db.collection(collectionName).insertOne({ marker: collectionName })
    }

    const originalIndexes = await projects.indexes()
    const originalOptions = (await db.listCollections({ name: "projects" }).next()).options
    const deletedKeys = []
    await resetProjectData(db, undefined, async (keys) => { deletedKeys.push(...keys) })
    assert.deepEqual(deletedKeys, ["projects/11111111-1111-4111-8111-111111111111.png"])
    for (const collectionName of ["projects", "projectViews", "projectStars"]) {
      assert.equal(await db.collection(collectionName).countDocuments(), 0, `${collectionName} is empty`)
    }
    for (const collectionName of ["user", "session", "account", "verification", "projectPublishRateLimit", "projectMetricsRateLimit", "projectReferenceSearchRateLimit", "unrelated"]) {
      assert.equal(await db.collection(collectionName).countDocuments(), 1, `${collectionName} is preserved`)
    }
    assert.deepEqual(await projects.indexes(), originalIndexes, "project indexes remain intact")
    assert.deepEqual((await db.listCollections({ name: "projects" }).next()).options, originalOptions, "project validation remains intact")
    await resetProjectData(db)
    assert.equal(await projects.countDocuments(), 0, "repeating the reset is safe")
    assert.equal(await db.collection("user").countDocuments(), 1)
  } finally {
    if (connected) await client.db(name).dropDatabase()
    await client.close()
  }
})
