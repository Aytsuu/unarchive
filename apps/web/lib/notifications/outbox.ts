import { ObjectId, type ClientSession, type Db } from "mongodb"
import { addedReferenceIds, belongsToReferenceGroup, notificationExpiry, referenceEventId, referenceGroupKey, starEventId, starGroupKey } from "./policy.ts"

type EventBase = {
  eventId: string
  schemaVersion: 1
  subjectId: string
  actorId: string
  occurredAt: Date
  state: "pending" | "leased" | "processed" | "dead"
  leaseOwner?: string
  leaseUntil?: Date
  attempts: number
  nextAttemptAt: Date
}

export type NotificationEvent = EventBase & (
  | { type: "project.referenced"; referencingProjectId: string; referencedProjectId: string }
  | { type: "project.starred"; starredProjectId: string }
  | { type: "project.publish_approved" | "project.revision_requested"; submissionId: string; projectId: string; recipientId: string }
)

type InboxBase = {
  _id: ObjectId
  recipientId: string
  dedupeKey: string
  groupKey: string
  eventIds: string[]
  count: number
  firstOccurredAt: Date
  lastOccurredAt: Date
  readAt: Date | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
}

type InboxRecord = InboxBase & (
  | { type: "project.referenced"; category: "project_reference"; referencedProjectId: string; latestReferencingProjectId: string }
  | { type: "project.starred"; category: "project_star"; starredProjectId: string; actorIds: string[] }
  | { type: "project.publish_approved" | "project.revision_requested"; category: "moderation"; submissionId: string; projectId: string }
)

const indexes = new WeakMap<Db, Promise<void>>()
const LEASE_MS = 30_000
const MAX_ATTEMPTS = 8

export async function ensureNotificationIndexes(db: Db): Promise<void> {
  let pending = indexes.get(db)
  if (!pending) {
    pending = Promise.all([
      db.collection<NotificationEvent>("notificationEvents").createIndex({ eventId: 1 }, { unique: true, name: "notification_event_id" }),
      db.collection<NotificationEvent>("notificationEvents").createIndex({ state: 1, nextAttemptAt: 1 }, { name: "notification_event_claim" }),
      db.collection<InboxRecord>("notifications").createIndex({ dedupeKey: 1 }, { unique: true, name: "notification_dedupe" }),
      db.collection<InboxRecord>("notifications").createIndex({ recipientId: 1, updatedAt: -1, _id: -1 }, { name: "notification_recipient_order" }),
      db.collection<InboxRecord>("notifications").createIndex({ recipientId: 1, readAt: 1, expiresAt: 1 }, { name: "notification_recipient_unread" }),
      db.collection("notificationPreferences").createIndex({ recipientId: 1 }, { unique: true, name: "notification_preferences_recipient" }),
    ]).then(() => undefined).catch((error: unknown) => { indexes.delete(db); throw error })
    indexes.set(db, pending)
  }
  await pending
}

export async function insertReferenceOutbox(db: Db, session: ClientSession, args: { projectId: ObjectId; version: number; actorId: string; occurredAt: Date; previousIds: readonly string[] | undefined; nextIds: readonly string[] | undefined }): Promise<void> {
  const added = addedReferenceIds(args.previousIds, args.nextIds)
  if (!added.length) return
  const projectId = args.projectId.toHexString()
  await db.collection<NotificationEvent>("notificationEvents").insertMany(added.map((referencedProjectId) => ({
    eventId: referenceEventId(projectId, args.version, referencedProjectId),
    type: "project.referenced",
    schemaVersion: 1,
    subjectId: referencedProjectId,
    actorId: args.actorId,
    referencingProjectId: projectId,
    referencedProjectId,
    occurredAt: args.occurredAt,
    state: "pending",
    attempts: 0,
    nextAttemptAt: args.occurredAt,
  })), { session })
}

export async function insertStarOutbox(db: Db, session: ClientSession, args: { projectId: ObjectId; actorId: string; occurredAt: Date }): Promise<void> {
  const projectId = args.projectId.toHexString()
  await db.collection<NotificationEvent>("notificationEvents").insertOne({
    eventId: starEventId(projectId, args.actorId, args.occurredAt),
    type: "project.starred",
    schemaVersion: 1,
    subjectId: projectId,
    actorId: args.actorId,
    starredProjectId: projectId,
    occurredAt: args.occurredAt,
    state: "pending",
    attempts: 0,
    nextAttemptAt: args.occurredAt,
  }, { session })
}

async function claimEvent(db: Db, workerId: string, now: Date): Promise<NotificationEvent | null> {
  const claimed = await db.collection<NotificationEvent>("notificationEvents").findOneAndUpdate(
    { state: { $in: ["pending", "leased"] }, nextAttemptAt: { $lte: now }, $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }, { state: "pending" }] },
    { $set: { state: "leased", leaseOwner: workerId, leaseUntil: new Date(now.getTime() + LEASE_MS) }, $inc: { attempts: 1 } },
    { sort: { nextAttemptAt: 1 }, returnDocument: "after" },
  )
  return claimed
}

async function finishEvent(db: Db, eventId: string, workerId: string): Promise<void> {
  await db.collection<NotificationEvent>("notificationEvents").updateOne({ eventId, leaseOwner: workerId, state: "leased" }, { $set: { state: "processed" }, $unset: { leaseOwner: "", leaseUntil: "" } })
}

async function retryEvent(db: Db, event: NotificationEvent, now: Date): Promise<void> {
  const dead = event.attempts >= MAX_ATTEMPTS
  const delay = Math.min(60 * 60 * 1000, 1000 * 2 ** event.attempts)
  await db.collection<NotificationEvent>("notificationEvents").updateOne({ eventId: event.eventId, leaseOwner: event.leaseOwner, state: "leased" }, {
    $set: dead ? { state: "dead", nextAttemptAt: now } : { state: "pending", nextAttemptAt: new Date(now.getTime() + delay) },
    $unset: { leaseOwner: "", leaseUntil: "" },
  })
}

// A transactional write to one record per group serializes concurrent workers.
// MongoDB retries transactions after write conflicts, including the initial insert.
async function withGroupTransaction(db: Db, groupKey: string, work: (session: ClientSession) => Promise<void>): Promise<void> {
  const locks = db.collection<{ _id: string; version: number }>("notificationGroupLocks")
  try {
    await locks.updateOne({ _id: groupKey }, { $setOnInsert: { version: 0 } }, { upsert: true })
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error
  }
  const session = db.client.startSession()
  try {
    await session.withTransaction(async () => {
      await locks.updateOne({ _id: groupKey }, { $inc: { version: 1 } }, { session })
      await work(session)
    })
  } finally { await session.endSession() }
}

async function deliverReference(db: Db, event: Extract<NotificationEvent, { type: "project.referenced" }>): Promise<void> {
  const projects = db.collection<{ _id: ObjectId; ownerId: string; withdrawnAt?: Date }>("projects")
  const referenced = await projects.findOne({ _id: new ObjectId(event.referencedProjectId) }, { projection: { ownerId: 1, withdrawnAt: 1 } })
  if (!referenced || referenced.withdrawnAt || referenced.ownerId === event.actorId) return
  const groupKey = referenceGroupKey(referenced.ownerId, event.referencedProjectId)
  const inbox = db.collection<Extract<InboxRecord, { type: "project.referenced" }>>("notifications")
  await withGroupTransaction(db, groupKey, async (session) => {
    if (await inbox.findOne({ recipientId: referenced.ownerId, groupKey, eventIds: event.eventId }, { session })) return
    const existing = await inbox.find({ recipientId: referenced.ownerId, groupKey }, { session }).sort({ lastOccurredAt: -1 }).limit(1).next()
    if (existing && belongsToReferenceGroup(existing.lastOccurredAt, event.occurredAt)) {
      const lastOccurredAt = event.occurredAt > existing.lastOccurredAt ? event.occurredAt : existing.lastOccurredAt
      await inbox.updateOne({ _id: existing._id }, {
        $addToSet: { eventIds: event.eventId },
        $set: { readAt: null, updatedAt: lastOccurredAt, firstOccurredAt: event.occurredAt < existing.firstOccurredAt ? event.occurredAt : existing.firstOccurredAt, lastOccurredAt, latestReferencingProjectId: event.occurredAt >= existing.lastOccurredAt ? event.referencingProjectId : existing.latestReferencingProjectId, expiresAt: notificationExpiry(lastOccurredAt), count: existing.eventIds.length + 1 },
      }, { session })
      return
    }
    await inbox.insertOne({
      _id: new ObjectId(),
      recipientId: referenced.ownerId,
      dedupeKey: `${event.eventId}:${referenced.ownerId}`,
      groupKey,
      type: "project.referenced",
      category: "project_reference",
      referencedProjectId: event.referencedProjectId,
      latestReferencingProjectId: event.referencingProjectId,
      eventIds: [event.eventId],
      count: 1,
      firstOccurredAt: event.occurredAt,
      lastOccurredAt: event.occurredAt,
      readAt: null,
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
      expiresAt: notificationExpiry(event.occurredAt),
    }, { session })
  })
}

async function deliverStar(db: Db, event: Extract<NotificationEvent, { type: "project.starred" }>): Promise<void> {
  const projects = db.collection<{ _id: ObjectId; ownerId: string; withdrawnAt?: Date }>("projects")
  const starred = await projects.findOne({ _id: new ObjectId(event.starredProjectId) }, { projection: { ownerId: 1, withdrawnAt: 1 } })
  if (!starred || starred.withdrawnAt || starred.ownerId === event.actorId) return
  const groupKey = starGroupKey(starred.ownerId, event.starredProjectId)
  const inbox = db.collection<Extract<InboxRecord, { type: "project.starred" }>>("notifications")
  await withGroupTransaction(db, groupKey, async (session) => {
    if (await inbox.findOne({ recipientId: starred.ownerId, groupKey, eventIds: event.eventId }, { session })) return
    const existing = await inbox.find({ recipientId: starred.ownerId, groupKey, type: "project.starred" }, { session }).sort({ lastOccurredAt: -1 }).limit(1).next()
    if (existing && belongsToReferenceGroup(existing.lastOccurredAt, event.occurredAt)) {
      if (existing.actorIds.includes(event.actorId)) {
        await inbox.updateOne({ _id: existing._id }, { $addToSet: { eventIds: event.eventId } }, { session })
        return
      }
      const lastOccurredAt = event.occurredAt > existing.lastOccurredAt ? event.occurredAt : existing.lastOccurredAt
      await inbox.updateOne({ _id: existing._id }, {
        $addToSet: { eventIds: event.eventId, actorIds: event.actorId },
        $set: { readAt: null, updatedAt: lastOccurredAt, firstOccurredAt: event.occurredAt < existing.firstOccurredAt ? event.occurredAt : existing.firstOccurredAt, lastOccurredAt, expiresAt: notificationExpiry(lastOccurredAt), count: existing.actorIds.length + 1 },
      }, { session })
      return
    }
    await inbox.insertOne({
      _id: new ObjectId(),
      recipientId: starred.ownerId,
      dedupeKey: `${event.eventId}:${starred.ownerId}`,
      groupKey,
      type: "project.starred",
      category: "project_star",
      starredProjectId: event.starredProjectId,
      actorIds: [event.actorId],
      eventIds: [event.eventId],
      count: 1,
      firstOccurredAt: event.occurredAt,
      lastOccurredAt: event.occurredAt,
      readAt: null,
      createdAt: event.occurredAt,
      updatedAt: event.occurredAt,
      expiresAt: notificationExpiry(event.occurredAt),
    }, { session })
  })
}

async function deliverModeration(db: Db, event: Extract<NotificationEvent, { type: "project.publish_approved" | "project.revision_requested" }>): Promise<void> {
  if (!ObjectId.isValid(event.submissionId) || !ObjectId.isValid(event.projectId)) throw new Error("Invalid moderation notification event")
  const submission = await db.collection("projectSubmissions").findOne({ _id: new ObjectId(event.submissionId), ownerId: event.recipientId }, { projection: { _id: 1 } })
  if (!submission) return
  const key = `${event.eventId}:${event.recipientId}`
  await db.collection("notifications").updateOne({ dedupeKey: key }, { $setOnInsert: {
    recipientId: event.recipientId, dedupeKey: key, groupKey: key, type: event.type, category: "moderation",
    submissionId: event.submissionId, projectId: event.projectId, eventIds: [event.eventId], count: 1,
    firstOccurredAt: event.occurredAt, lastOccurredAt: event.occurredAt, readAt: null,
    createdAt: event.occurredAt, updatedAt: event.occurredAt, expiresAt: notificationExpiry(event.occurredAt),
  } }, { upsert: true })
  const { enqueueModerationEmail } = await import("./moderation-email.ts")
  await enqueueModerationEmail(db, event)
}

export async function processNotificationOutbox(db: Db, workerId: string, limit = 20): Promise<number> {
  await ensureNotificationIndexes(db)
  let processed = 0
  for (let index = 0; index < limit; index += 1) {
    const now = new Date()
    const event = await claimEvent(db, workerId, now)
    if (!event) break
    try {
      if (event.type === "project.referenced") await deliverReference(db, event)
      else if (event.type === "project.starred") await deliverStar(db, event)
      else if (event.type === "project.publish_approved" || event.type === "project.revision_requested") await deliverModeration(db, event)
      else throw new Error("Unknown notification event type")
      await finishEvent(db, event.eventId, workerId)
      processed += 1
    } catch (error) {
      console.error("Notification event processing failed")
      await retryEvent(db, event, now)
      if (!(error instanceof Error)) throw new Error("Notification event processing failed")
    }
  }
  return processed
}
