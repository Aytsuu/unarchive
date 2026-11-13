import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { MongoClient } from "mongodb"
import { validateLocalTarget } from "../scripts/reset-auth.mjs"
import { deleteDemosFromR2, resetProjectData } from "../scripts/reset-projects.mjs"

const uri = process.env.MONGODB_URI
const firstKey = "projects/11111111-1111-4111-8111-111111111111.png"
const secondKey = "projects/22222222-2222-4222-8222-222222222222.jpg"
const historicalKey = "projects/33333333-3333-4333-8333-333333333333.png"

test("R2 deletion uses only project keys in the configured bucket and closes the client", async () => {
  const environment = {
    R2_ACCOUNT_ID: "a".repeat(32), R2_ACCESS_KEY_ID: "test-access", R2_SECRET_ACCESS_KEY: "test-secret", R2_BUCKET_NAME: "project-tests",
  }
  const requests = []
  let destroyed = 0
  let options
  const createClient = (config) => {
    options = config
    return { send: async (command) => { requests.push(command.input) }, destroy: () => { destroyed++ } }
  }
  await deleteDemosFromR2([firstKey, secondKey], environment, createClient)
  assert.deepEqual(requests, [{ Bucket: "project-tests", Key: firstKey }, { Bucket: "project-tests", Key: secondKey }])
  assert.equal(options.endpoint, `https://${"a".repeat(32)}.r2.cloudflarestorage.com`)
  assert.equal(destroyed, 1)

  let clients = 0
  const failOnClient = () => { clients++; throw new Error("Unexpected client") }
  await deleteDemosFromR2([], {}, failOnClient)
  await assert.rejects(deleteDemosFromR2([firstKey], {}, failOnClient))
  await assert.rejects(deleteDemosFromR2(["other/object.png"], environment, failOnClient))
  assert.equal(clients, 0, "invalid keys or settings must be rejected before contacting R2")

  let closedAfterFailure = false
  await assert.rejects(deleteDemosFromR2([firstKey], environment, () => ({
    send: async () => { throw new Error("R2 failure") },
    destroy: () => { closedAfterFailure = true },
  })))
  assert.equal(closedAfterFailure, true, "R2 client closes even when deletion fails")
})

test("R2 reset deduplicates referenced assets and leaves records intact on failure", { skip: !uri && "MONGODB_URI is required" }, async () => {
  const databaseName = `projects_reset_r2_test_${randomUUID().replaceAll("-", "")}`
  validateLocalTarget(uri, databaseName)
  const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  let connected = false
  try {
    await client.connect()
    connected = true
    const db = client.db(databaseName)
    const projects = db.collection("projects")
    await projects.insertMany([{ demos: [firstKey, secondKey] }, { demos: [firstKey] }, { title: "No images" }])
    await db.collection("projectViews").insertOne({ marker: true })
    await db.collection("projectStars").insertOne({ marker: true })
    const versions = db.collection("projectVersions")
    await versions.insertMany([{ snapshot: { demos: [historicalKey, firstKey] } }, { snapshot: { demos: [historicalKey] } }])

    let attempts = 0
    await assert.rejects(resetProjectData(db, undefined, async () => { attempts++; throw new Error("R2 unavailable") }))
    assert.equal(attempts, 1)
    assert.equal(await projects.countDocuments(), 3, "failed R2 cleanup must preserve project keys for retry")
    assert.equal(await db.collection("projectViews").countDocuments(), 1)
    assert.equal(await db.collection("projectStars").countDocuments(), 1)
    assert.equal(await versions.countDocuments(), 2, "failed R2 cleanup preserves version records")

    const keys = []
    await resetProjectData(db, undefined, async (batch) => { keys.push(...batch) })
    assert.deepEqual([...keys].sort(), [firstKey, secondKey, historicalKey].sort(), "current and historical referenced keys are deleted once")
    assert.equal(await projects.countDocuments(), 0)
    assert.equal(await versions.countDocuments(), 0, "version records are deleted")

    await projects.insertOne({ demos: [firstKey], title: "Snapshot project" })
    await db.collection("projectViews").insertOne({ marker: "snapshot" })
    await resetProjectData(db, undefined, async () => {
      await projects.insertOne({ title: "New project" })
      await db.collection("projectViews").insertOne({ marker: "new" })
    })
    assert.equal(await projects.countDocuments({ title: "New project" }), 1, "a project created during R2 cleanup is retained")
    assert.equal(await db.collection("projectViews").countDocuments({ marker: "new" }), 1, "a view created during R2 cleanup is retained")
    await projects.deleteMany({})
    await db.collection("projectViews").deleteMany({})

    let calls = 0
    await projects.insertOne({ title: "No images" })
    await resetProjectData(db, undefined, async () => { calls++ })
    assert.equal(calls, 0, "projects without images do not contact R2")

    for (const invalid of [{}, { snapshot: null }, { snapshot: {} }, { snapshot: { demos: null } }, { snapshot: { demos: ["unrelated/object.png"] } }]) {
      await versions.insertOne(invalid)
      let invalidVersionCalls = 0
      await assert.rejects(resetProjectData(db, undefined, async () => { invalidVersionCalls++ }))
      assert.equal(invalidVersionCalls, 0, "invalid historical data must fail before contacting R2")
      assert.equal(await versions.countDocuments(), 1, "invalid historical record must remain for inspection")
      await versions.deleteMany({})
    }

    for (const demos of [["unrelated/object.png"], [7], "not-an-array", null]) {
      await projects.insertOne({ demos })
      let callsForInvalidData = 0
      await assert.rejects(resetProjectData(db, undefined, async () => { callsForInvalidData++ }))
      assert.equal(callsForInvalidData, 0, "invalid keys must be rejected before any R2 operation")
      assert.equal(await projects.countDocuments(), 1, "invalid data must not be removed")
      await projects.deleteMany({})
    }
  } finally {
    if (connected) await client.db(databaseName).dropDatabase()
    await client.close()
  }
})
