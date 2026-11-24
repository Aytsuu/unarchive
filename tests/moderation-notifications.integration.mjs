import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { MongoClient, ObjectId } from "mongodb"
import { decideSubmission, resubmitSubmission } from "../packages/domain/submissions.mjs"

test("moderation decisions and resubmissions commit with durable events", async () => {
  const client = new MongoClient(process.env.MONGODB_URI, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const db = client.db(`moderation_decisions_${randomUUID().replaceAll("-", "")}`)
  try {
    await client.connect()
    const id = new ObjectId()
    await db.collection("projectSubmissions").insertOne({ _id: id, ownerId: "owner", status: "pending", snapshot: { title: "Project", demos: [] } })
    assert.deepEqual(await decideSubmission(db, { id: String(id), moderatorId: "mod", action: "request_revision", reason: "Explain methods" }, client), { ok: true, status: "changes_requested" })
    assert.equal(await db.collection("notificationEvents").countDocuments({ eventId: `project.revision_requested:${id}` }), 1)
    const nextId = new ObjectId()
    const input = { previousId: String(id), id: nextId, ownerId: "owner", submittedAt: new Date(), project: { title: "Updated project" }, demos: [], idempotencyDigest: "digest" }
    assert.deepEqual(await resubmitSubmission(client, db, input), { ok: true, id: String(nextId), replayed: false })
    assert.deepEqual(await resubmitSubmission(client, db, input), { ok: true, id: String(nextId), replayed: true })
    const original = await db.collection("projectSubmissions").findOne({ _id: id })
    assert.equal(String(original.resubmittedAs), String(nextId))
    assert.equal((await db.collection("projectSubmissions").findOne({ _id: nextId })).projectId.toString(), String(id))
    assert.deepEqual(await decideSubmission(db, { id: String(nextId), moderatorId: "mod", action: "approve" }, client), { ok: true, status: "approved" })
    assert.equal((await db.collection("projects").findOne({ _id: id })).title, "Updated project")
    assert.equal(await db.collection("notificationEvents").countDocuments({ eventId: `project.publish_approved:${nextId}` }), 1)
    assert.deepEqual(await decideSubmission(db, { id: String(nextId), moderatorId: "other", action: "approve" }, client), { ok: false, error: "conflict" })
    const failedId = new ObjectId()
    await db.collection("projectSubmissions").insertOne({ _id: failedId, ownerId: "owner", status: "pending", snapshot: { title: "Failed", demos: [] } })
    await db.collection("notificationEvents").insertOne({ eventId: `project.publish_approved:${failedId}` })
    await assert.rejects(() => decideSubmission(db, { id: String(failedId), moderatorId: "mod", action: "approve" }, client))
    assert.equal((await db.collection("projectSubmissions").findOne({ _id: failedId })).status, "pending")
    assert.equal(await db.collection("projects").countDocuments({ _id: failedId }), 0)
    assert.equal(await db.collection("projectVersions").countDocuments({ projectId: failedId }), 0)
    assert.deepEqual(await resubmitSubmission(client, db, { ...input, ownerId: "intruder" }), { ok: false, error: "not_found" })
  } finally {
    await db.dropDatabase()
    await client.close()
  }
})
