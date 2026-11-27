import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import test from "node:test"
import { MongoClient, ObjectId } from "mongodb"
import { insertPendingSubmission, PUBLISH_WEBHOOK_COLLECTION, PUBLISH_WEBHOOK_EVENT_TYPE, resubmitSubmission, SUBMISSIONS_COLLECTION } from "../packages/domain/submissions.mjs"
import { deliverPublishWebhooks } from "../apps/web/lib/webhooks/publish-moderation.ts"

test("publication submissions and webhook deliveries commit together", async () => {
  const client = new MongoClient(process.env.MONGODB_URI, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const db = client.db(`publish_webhook_${randomUUID().replaceAll("-", "")}`)
  try {
    await client.connect()
    const submittedAt = new Date("2026-11-26T00:00:00.000Z")
    const input = { id: new ObjectId(), ownerId: "owner", submittedAt, project: { title: "Coastal sensors" }, demos: [] }
    await insertPendingSubmission(db, input, client)
    await assert.rejects(() => insertPendingSubmission(db, input, client), (error) => error.code === 11000)
    assert.equal(await db.collection(SUBMISSIONS_COLLECTION).countDocuments({ _id: input.id }), 1)
    assert.equal(await db.collection(PUBLISH_WEBHOOK_COLLECTION).countDocuments({ eventId: input.id.toString() }), 1)
    const stored = await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: input.id.toString() })
    assert.equal(stored.type, PUBLISH_WEBHOOK_EVENT_TYPE)
    assert.equal(stored.submissionId, input.id.toString())
    assert.equal(stored.state, "pending")

    const previousId = new ObjectId()
    const nextId = new ObjectId()
    await db.collection(SUBMISSIONS_COLLECTION).insertOne({
      _id: previousId,
      ownerId: "owner",
      status: "changes_requested",
      submittedAt,
      snapshot: { title: "Original title", demos: [] },
    })
    const resubmittedAt = new Date("2026-11-26T01:00:00.000Z")
    const revision = {
      previousId: previousId.toString(),
      id: nextId,
      ownerId: "owner",
      submittedAt: resubmittedAt,
      project: { title: "Revised title" },
      demos: [],
      idempotencyDigest: "digest",
    }
    assert.deepEqual(await resubmitSubmission(client, db, revision, { notify: true }), { ok: true, id: nextId.toString(), replayed: false })
    assert.deepEqual(await resubmitSubmission(client, db, revision, { notify: true }), { ok: true, id: nextId.toString(), replayed: true })
    assert.equal(await db.collection(PUBLISH_WEBHOOK_COLLECTION).countDocuments({ eventId: nextId.toString() }), 1)
    assert.equal((await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: nextId.toString() })).submissionId, nextId.toString())
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).updateOne({ eventId: nextId.toString() }, { $set: { state: "dead" } })
    const failedRevisionId = new ObjectId()
    const failedNextId = new ObjectId()
    await db.collection(SUBMISSIONS_COLLECTION).insertOne({
      _id: failedRevisionId,
      ownerId: "owner",
      status: "changes_requested",
      submittedAt,
      snapshot: { title: "Failed revision", demos: [] },
    })
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne({
      eventId: failedNextId.toString(),
      type: PUBLISH_WEBHOOK_EVENT_TYPE,
      submissionId: failedNextId.toString(),
      state: "dead",
      attempts: 0,
      nextAttemptAt: submittedAt,
      occurredAt: submittedAt,
    })
    await assert.rejects(() => resubmitSubmission(client, db, {
      previousId: failedRevisionId.toString(),
      id: failedNextId,
      ownerId: "owner",
      submittedAt: resubmittedAt,
      project: { title: "Rolled back revision" },
      demos: [],
      idempotencyDigest: "failed-digest",
    }, { notify: true }))
    assert.equal(await db.collection(SUBMISSIONS_COLLECTION).countDocuments({ _id: failedNextId }), 0)
    assert.equal((await db.collection(SUBMISSIONS_COLLECTION).findOne({ _id: failedRevisionId })).status, "changes_requested")

    const failedId = new ObjectId()
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne({
      eventId: failedId.toString(),
      type: PUBLISH_WEBHOOK_EVENT_TYPE,
      submissionId: failedId.toString(),
      state: "pending",
      attempts: 0,
      nextAttemptAt: submittedAt,
      occurredAt: submittedAt,
    })
    await assert.rejects(() => insertPendingSubmission(db, { id: failedId, ownerId: "owner", submittedAt, project: { title: "Rolled back" }, demos: [] }, client))
    assert.equal(await db.collection(SUBMISSIONS_COLLECTION).countDocuments({ _id: failedId }), 0)
    assert.equal(await db.collection(PUBLISH_WEBHOOK_COLLECTION).countDocuments({ eventId: failedId.toString() }), 1)
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).updateOne({ eventId: failedId.toString() }, { $set: { state: "dead" } })

    const calls = []
    const fetch = async (url, init) => {
      calls.push({ url, init })
      if (calls.length === 1) return new Response("unavailable", { status: 503 })
      return new Response(null, { status: 204 })
    }
    const now = new Date("2026-11-26T02:00:00.000Z")
    assert.equal(await deliverPublishWebhooks(db, "worker-a", { now, fetch, url: "https://bot.example/hook", secret: "local-webhook-secret", development: true, limit: 10 }), 0)
    assert.equal((await db.collection(SUBMISSIONS_COLLECTION).findOne({ _id: input.id })).status, "pending")
    let delivery = await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: input.id.toString() })
    assert.equal(delivery.state, "pending")
    assert.equal(delivery.attempts, 1)
    assert.match(delivery.lastError, /^HTTP 503/)
    assert.equal(await deliverPublishWebhooks(db, "worker-b", { now: delivery.nextAttemptAt, fetch, url: "https://bot.example/hook", secret: "local-webhook-secret", development: true, limit: 10 }), 1)
    delivery = await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: input.id.toString() })
    assert.equal(delivery.state, "delivered")
    assert.equal(JSON.parse(calls[0].init.body).submissionId, input.id.toString())
    assert.equal(calls[0].init.headers.authorization, "Bearer local-webhook-secret")

    const leasedId = new ObjectId()
    await insertPendingSubmission(db, { id: leasedId, ownerId: "owner", submittedAt: now, project: { title: "Leased submission" }, demos: [] }, client)
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).updateOne({ eventId: leasedId.toString() }, {
      $set: { state: "leased", attempts: 1, leaseOwner: "worker-old", leaseUntil: new Date(now.getTime() - 1000), nextAttemptAt: now },
    })
    assert.equal(await deliverPublishWebhooks(db, "worker-restarted", { now, fetch, url: "https://bot.example/hook", secret: "local-webhook-secret", development: true, limit: 10 }), 1)
    assert.equal((await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: leasedId.toString() })).state, "delivered")
    assert.equal((await db.collection(SUBMISSIONS_COLLECTION).findOne({ _id: leasedId })).status, "pending")
  } finally {
    await db.dropDatabase()
    await client.close()
  }
})
