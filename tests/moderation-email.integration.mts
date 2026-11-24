import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { MongoClient, ObjectId } from "mongodb"
import { enqueueModerationEmail, processModerationEmails } from "../apps/web/lib/notifications/moderation-email.ts"

test("moderation mail is queued once, rechecks preferences and retries with a stable key", async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const name = `moderation_email_${randomUUID().replaceAll("-", "")}`
  try {
    await client.connect()
    const db = client.db(name)
    const recipient = new ObjectId()
    const submission = new ObjectId().toHexString()
    await db.collection("user").insertOne({ _id: recipient, email: "author@example.test", emailVerified: true })
    const event = { eventId: `revision:${submission}`, type: "project.revision_requested" as const, recipientId: recipient.toHexString(), submissionId: submission, projectId: submission, occurredAt: new Date() }
    await enqueueModerationEmail(db, event)
    await enqueueModerationEmail(db, event)
    assert.equal(await db.collection("notificationDeliveries").countDocuments(), 1)
    let now = new Date()
    const keys: string[] = []
    await processModerationEmails(db, "test", { now: () => now, baseURL: "https://example.test", send: async (message) => { keys.push(message.idempotencyKey); throw new Error("timeout") } })
    assert.equal((await db.collection("notificationDeliveries").findOne({ eventId: event.eventId }))?.state, "pending")
    now = new Date(now.getTime() + 60_000)
    await processModerationEmails(db, "test", { now: () => now, baseURL: "https://example.test", send: async (message) => { keys.push(message.idempotencyKey) } })
    assert.deepEqual(keys, [keys[0], keys[0]])
    const accepted = await db.collection("notificationDeliveries").findOne({ eventId: event.eventId })
    assert.equal(accepted?.state, "accepted")
    assert.equal(accepted?.address, undefined)

    const skipped = { ...event, eventId: `approval:${submission}`, type: "project.publish_approved" as const }
    await enqueueModerationEmail(db, skipped)
    await db.collection("notificationPreferences").insertOne({ recipientId: recipient.toHexString(), email: { publishApproved: false } })
    await processModerationEmails(db, "test", { now: () => now, baseURL: "https://example.test", send: async () => { assert.fail("disabled email was sent") } })
    assert.equal((await db.collection("notificationDeliveries").findOne({ eventId: skipped.eventId }))?.state, "skipped")

    const expired = { ...event, eventId: `expired:${submission}` }
    await enqueueModerationEmail(db, expired)
    await db.collection("notificationDeliveries").updateOne({ eventId: expired.eventId }, { $set: { firstAttemptAt: new Date(now.getTime() - 24 * 60 * 60_000), address: "author@example.test" } })
    await processModerationEmails(db, "test", { now: () => now, baseURL: "https://example.test", send: async () => { assert.fail("expired retry was sent") } })
    assert.equal((await db.collection("notificationDeliveries").findOne({ eventId: expired.eventId }))?.state, "dead")
  } finally {
    await client.db(name).dropDatabase()
    await client.close()
  }
})
