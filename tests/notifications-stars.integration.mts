import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { MongoClient, ObjectId } from "mongodb"

const { setProjectStar } = await import(new URL("../lib/projects/metrics.ts", import.meta.url).href)
const { processNotificationOutbox } = await import(new URL("../lib/notifications/outbox.ts", import.meta.url).href)
const { listNotifications, markNotificationRead } = await import(new URL("../lib/notifications/inbox.ts", import.meta.url).href)
const { starEventId } = await import(new URL("../lib/notifications/policy.ts", import.meta.url).href)

test("a new star notifies the owner once per person, and repeats, removals, self-stars, and withdrawn projects do not", async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const name = `notification_stars_${randomUUID().replaceAll("-", "")}`
  try {
    await client.connect()
    const db = client.db(name)
    const projectId = new ObjectId()
    const ownerId = "owner-1"
    const firstFan = "fan-1"
    const secondFan = "fan-2"
    await db.collection("projects").insertOne({ _id: projectId, ownerId, title: "Signal Desk", withdrawnAt: undefined })
    await db.collection("projects").updateOne({ _id: projectId }, { $unset: { withdrawnAt: "" } })

    const firstAt = new Date("2026-11-20T09:00:00.000Z")
    await setProjectStar(db, projectId, firstFan, true, client, firstAt)
    await setProjectStar(db, projectId, firstFan, true, client, new Date("2026-11-20T09:05:00.000Z"))
    assert.equal(await db.collection("notificationEvents").countDocuments({ type: "project.starred" }), 1)
    assert.equal(await processNotificationOutbox(db, "star-test"), 1)

    const created = await listNotifications(db, ownerId, "all", null, new Date("2026-11-20T10:00:00.000Z"))
    assert.equal(created.notifications.length, 1)
    assert.equal(created.notifications[0].type, "project.starred")
    assert.equal(created.notifications[0].title, "Your project received a star")
    assert.equal(created.notifications[0].body, "Someone starred your project.")
    assert.deepEqual(created.notifications[0].target, { type: "project", id: projectId.toHexString() })
    assert.equal(created.unreadCount, 1)
    assert.equal(await markNotificationRead(db, ownerId, created.notifications[0].id, new Date("2026-11-20T10:00:00.000Z")), true)

    await setProjectStar(db, projectId, firstFan, false, client)
    assert.equal(await db.collection("notificationEvents").countDocuments({}), 1)
    const afterRemoval = await listNotifications(db, ownerId, "all", null, new Date("2026-11-20T10:30:00.000Z"))
    assert.equal(afterRemoval.notifications.length, 1)
    assert.equal(afterRemoval.notifications[0].readAt === null, false)

    await setProjectStar(db, projectId, firstFan, true, client, new Date("2026-11-20T11:00:00.000Z"))
    assert.equal(await processNotificationOutbox(db, "star-test"), 1)
    const restar = await listNotifications(db, ownerId, "all", null, new Date("2026-11-20T11:30:00.000Z"))
    assert.equal(restar.notifications.length, 1)
    assert.equal(restar.notifications[0].group, null)
    assert.equal(restar.notifications[0].readAt === null, false)
    assert.equal(restar.unreadCount, 0)

    await setProjectStar(db, projectId, secondFan, true, client, new Date("2026-11-20T12:00:00.000Z"))
    await setProjectStar(db, projectId, ownerId, true, client, new Date("2026-11-20T12:05:00.000Z"))
    assert.equal(await processNotificationOutbox(db, "star-test"), 2)
    const grouped = await listNotifications(db, ownerId, "all", null, new Date("2026-11-20T12:30:00.000Z"))
    assert.equal(grouped.notifications.length, 1)
    assert.equal(grouped.notifications[0].body, "2 people starred your project.")
    assert.equal(grouped.notifications[0].group?.count, 2)
    assert.equal(grouped.notifications[0].readAt, null)
    assert.equal(grouped.unreadCount, 1)
    const stored = await db.collection<{ actorIds: string[] }>("notifications").findOne({ recipientId: ownerId })
    assert.deepEqual(stored?.actorIds, [firstFan, secondFan])

    await db.collection("projects").updateOne({ _id: projectId }, { $set: { withdrawnAt: new Date("2026-11-20T13:00:00.000Z") } })
    const hidden = await listNotifications(db, ownerId, "all", null, new Date("2026-11-20T13:30:00.000Z"))
    assert.equal(hidden.notifications[0].title, "A project star is unavailable")
    assert.equal(hidden.notifications[0].target, null)

    const collisionAt = new Date("2026-11-20T14:00:00.000Z")
    const otherProject = new ObjectId()
    await db.collection("projects").insertOne({ _id: otherProject, ownerId, title: "Other" })
    await db.collection("notificationEvents").insertOne({ eventId: starEventId(otherProject.toHexString(), "fan-3", collisionAt), type: "project.starred", schemaVersion: 1, subjectId: otherProject.toHexString(), actorId: "fan-3", starredProjectId: otherProject.toHexString(), occurredAt: collisionAt, state: "processed", attempts: 1, nextAttemptAt: collisionAt })
    await assert.rejects(() => setProjectStar(db, otherProject, "fan-3", true, client, collisionAt))
    assert.equal(await db.collection("projectStars").countDocuments({ projectId: otherProject, userId: "fan-3" }), 0)
  } finally {
    await client.db(name).dropDatabase()
    await client.close()
  }
})
