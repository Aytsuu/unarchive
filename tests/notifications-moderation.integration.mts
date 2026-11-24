import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { MongoClient, ObjectId } from "mongodb"

const { processNotificationOutbox } = await import(new URL("../apps/web/lib/notifications/outbox.ts", import.meta.url).href)
const { listNotifications, markNotificationRead, markNotificationsRead, readNotificationPreferences } = await import(new URL("../apps/web/lib/notifications/inbox.ts", import.meta.url).href)

test("moderation notifications keep action state independent of read state and recipient", async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const name = `notification_moderation_${randomUUID().replaceAll("-", "")}`
  try {
    await client.connect()
    const db = client.db(name)
    const id = new ObjectId()
    const now = new Date()
    await db.collection("projectSubmissions").insertOne({ _id: id, ownerId: "owner", status: "changes_requested", snapshot: { title: "Private project" } })
    await db.collection("notificationEvents").insertOne({ eventId: `project.revision_requested:${id}`, type: "project.revision_requested", schemaVersion: 1, subjectId: id.toHexString(), submissionId: id.toHexString(), projectId: id.toHexString(), recipientId: "owner", actorId: "moderator", occurredAt: now, state: "pending", attempts: 0, nextAttemptAt: now })
    assert.equal(await processNotificationOutbox(db, "test"), 1)
    const actions = await listNotifications(db, "owner", "action-required", null)
    assert.equal(actions.notifications.length, 1)
    assert.deepEqual(actions.notifications[0].target, { type: "submission", id: id.toHexString() })
    assert.equal((await listNotifications(db, "other", "all", null)).notifications.length, 0)
    assert.equal(await markNotificationRead(db, "owner", actions.notifications[0].id), true)
    assert.equal((await listNotifications(db, "owner", "action-required", null)).notifications.length, 1)
    await db.collection("projectSubmissions").updateOne({ _id: id }, { $set: { resubmittedAt: new Date() } })
    assert.equal((await listNotifications(db, "owner", "action-required", null)).notifications.length, 0)
    assert.equal((await listNotifications(db, "owner", "all", null)).notifications.length, 1)
    const prefs = await readNotificationPreferences(db, "owner")
    assert.equal(prefs.email.publishApproved, true)
    assert.equal(prefs.email.revisionRequested, true)
    const approved = new ObjectId()
    await db.collection("projectSubmissions").insertOne({ _id: approved, ownerId: "owner", status: "approved", snapshot: { title: "Published" } })
    await db.collection("projects").insertOne({ _id: approved, ownerId: "owner", title: "Published" })
    const approvedEvent = { eventId: `project.publish_approved:${approved}`, type: "project.publish_approved", schemaVersion: 1, subjectId: approved.toHexString(), submissionId: approved.toHexString(), projectId: approved.toHexString(), recipientId: "owner", actorId: "moderator", occurredAt: now, state: "pending", attempts: 0, nextAttemptAt: now }
    await db.collection("notificationEvents").insertOne(approvedEvent)
    assert.equal(await processNotificationOutbox(db, "test"), 1)
    const all = await listNotifications(db, "owner", "all", null)
    assert.deepEqual(all.notifications.find((item: { type: string }) => item.type === "project.publish_approved")?.target, { type: "project", id: approved.toHexString() })
    assert.equal((await listNotifications(db, "owner", "action-required", null)).notifications.length, 0)
    await db.collection("notificationEvents").updateOne({ eventId: approvedEvent.eventId }, { $set: { state: "pending" } })
    assert.equal(await processNotificationOutbox(db, "test"), 1)
    assert.equal(await db.collection("notifications").countDocuments({ type: "project.publish_approved" }), 1)
    assert.equal(await db.collection("notificationDeliveries").countDocuments({ eventId: approvedEvent.eventId }), 1)
  } finally {
    await client.db(name).dropDatabase()
    await client.close()
  }
})

test("mark all read preserves unresolved actions and respects the cutoff and recipient", async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const name = `notification_bulk_${randomUUID().replaceAll("-", "")}`
  try {
    await client.connect()
    const db = client.db(name)
    const submissionId = new ObjectId()
    const cutoff = new Date()
    const later = new Date(cutoff.getTime() + 1000)
    await db.collection("projectSubmissions").insertOne({ _id: submissionId, ownerId: "owner", status: "changes_requested" })
    const notification = (recipientId: string, updatedAt: Date) => ({
      recipientId, dedupeKey: new ObjectId().toHexString(), type: "project.revision_requested", submissionId: submissionId.toHexString(), projectId: submissionId.toHexString(),
      eventIds: [], count: 1, firstOccurredAt: updatedAt, lastOccurredAt: updatedAt, readAt: null, createdAt: updatedAt, updatedAt, expiresAt: new Date(later.getTime() + 86400000),
    })
    await db.collection("notifications").insertMany([notification("owner", cutoff), notification("owner", later), notification("other", cutoff)])
    assert.equal(await markNotificationsRead(db, "owner", cutoff, later), 1)
    const actions = await listNotifications(db, "owner", "action-required", null, later)
    assert.equal(actions.notifications.length, 2)
    assert.equal(actions.notifications.filter((item: { readAt: string | null }) => item.readAt !== null).length, 1)
    assert.equal(await db.collection("notifications").countDocuments({ recipientId: "other", readAt: null }), 1)
  } finally {
    await client.db(name).dropDatabase()
    await client.close()
  }
})
