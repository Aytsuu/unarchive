import { ObjectId, type Db } from "mongodb"
import { NOTIFICATION_PAGE_SIZE, defaultEmailPreferences, type EmailPreferenceKey } from "./policy.ts"
import { ensureNotificationIndexes } from "./outbox.ts"

type StoredNotification = {
  _id: ObjectId
  recipientId: string
  eventIds: string[]
  count: number
  firstOccurredAt: Date
  lastOccurredAt: Date
  readAt: Date | null
  createdAt: Date
  updatedAt: Date
  expiresAt: Date
} & (
  | { type: "project.referenced"; referencedProjectId: string; latestReferencingProjectId: string }
  | { type: "project.starred"; starredProjectId: string; actorIds: string[] }
  | { type: "project.publish_approved"; submissionId: string; projectId: string }
  | { type: "project.revision_requested"; submissionId: string; projectId: string }
)

type ProjectRecord = { _id: ObjectId; title: string; withdrawnAt?: Date }

export type NotificationDto = {
  id: string
  type: "project.referenced" | "project.starred" | "project.publish_approved" | "project.revision_requested"
  createdAt: string
  updatedAt: string
  readAt: string | null
  title: string
  body: string
  target: { type: "project" | "submission"; id: string } | null
  group: { count: number; firstOccurredAt: string; lastOccurredAt: string } | null
}

export type NotificationList = {
  notifications: NotificationDto[]
  unreadCount: number
  nextCursor: string | null
  cutoff: string
}

function encodeCursor(record: StoredNotification): string {
  return Buffer.from(`${record.updatedAt.toISOString()}|${record._id.toHexString()}`).toString("base64url")
}

function decodeCursor(cursor: string): { updatedAt: Date; id: ObjectId } | null {
  try {
    const [time, id] = Buffer.from(cursor, "base64url").toString("utf8").split("|")
    if (!time || !id || !/^[a-f\d]{24}$/i.test(id)) return null
    const updatedAt = new Date(time)
    if (Number.isNaN(updatedAt.getTime())) return null
    return { updatedAt, id: new ObjectId(id) }
  } catch {
    return null
  }
}

function linkedProjectId(record: StoredNotification): string | null {
  if (record.type === "project.starred") return record.starredProjectId
  if (record.type === "project.referenced") return record.latestReferencingProjectId
  if (record.type === "project.publish_approved") return record.projectId
  return null
}

function presentNotification(record: StoredNotification, titles: Map<string, string>): NotificationDto {
  const projectId = linkedProjectId(record)
  const accessible = projectId ? titles.get(projectId.toLowerCase()) : undefined
  const grouped = record.count > 1
  const group = grouped ? { count: record.count, firstOccurredAt: record.firstOccurredAt.toISOString(), lastOccurredAt: record.lastOccurredAt.toISOString() } : null
  const base = { id: record._id.toHexString(), createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(), readAt: record.readAt ? record.readAt.toISOString() : null, group }
  if (record.type === "project.revision_requested") return { ...base, type: record.type, title: "Revisions requested", body: "Your submission needs changes before it can be published.", target: { type: "submission", id: record.submissionId } }
  if (record.type === "project.publish_approved") return { ...base, type: record.type, title: accessible ? "Your project was approved" : "A published project is unavailable", body: accessible ? "Your project has been approved and published." : "This project is no longer available.", target: accessible ? { type: "project", id: record.projectId } : null }
  if (record.type === "project.starred") {
    return { ...base, type: record.type, title: accessible ? "Your project received a star" : "A project star is unavailable", body: accessible ? (grouped ? `${record.count} people starred your project.` : "Someone starred your project.") : "This project is no longer available.", target: accessible ? { type: "project", id: record.starredProjectId } : null }
  }
  return { ...base, type: record.type, title: accessible ? "Your project was referenced" : "A project reference is unavailable", body: accessible ? (grouped ? `${record.count} projects referenced yours. The latest is “${accessible}”.` : `“${accessible}” referenced your project.`) : "This project is no longer available.", target: accessible ? { type: "project", id: record.latestReferencingProjectId } : null }
}

function activeFilter(recipientId: string, now: Date, unread: boolean) {
  return { recipientId, expiresAt: { $gt: now }, ...(unread ? { readAt: null } : {}) }
}

export async function unreadNotificationCount(db: Db, recipientId: string, now = new Date()): Promise<number> {
  await ensureNotificationIndexes(db)
  return db.collection<StoredNotification>("notifications").countDocuments(activeFilter(recipientId, now, true), { maxTimeMS: 3000 })
}

export async function listNotifications(db: Db, recipientId: string, filter: "all" | "unread" | "action-required", cursor: string | null, now = new Date()): Promise<NotificationList> {
  await ensureNotificationIndexes(db)
  const query: Record<string, unknown> = activeFilter(recipientId, now, filter === "unread")
  if (filter === "action-required") {
    const pending = await db.collection("projectSubmissions").find({ ownerId: recipientId, status: "changes_requested", resubmittedAt: { $exists: false } }, { projection: { _id: 1 }, maxTimeMS: 3000 }).toArray()
    query.type = "project.revision_requested"
    query.submissionId = { $in: pending.map((item) => item._id.toString()) }
  }
  if (cursor) {
    const decoded = decodeCursor(cursor)
    if (!decoded) throw new Error("invalid-cursor")
    query.$or = [{ updatedAt: { $lt: decoded.updatedAt } }, { updatedAt: decoded.updatedAt, _id: { $lt: decoded.id } }]
  }
  const records = await db.collection<StoredNotification>("notifications").find(query, { maxTimeMS: 3000 }).sort({ updatedAt: -1, _id: -1 }).limit(NOTIFICATION_PAGE_SIZE + 1).toArray()
  const page = records.slice(0, NOTIFICATION_PAGE_SIZE)
  const projectIds = [...new Set(page.map(linkedProjectId).filter((id): id is string => typeof id === "string" && /^[a-f\d]{24}$/i.test(id)))]
  const projects = projectIds.length ? await db.collection<ProjectRecord>("projects").find({ _id: { $in: projectIds.map((id) => new ObjectId(id)) }, withdrawnAt: { $exists: false } }, { projection: { title: 1 }, maxTimeMS: 3000 }).toArray() : []
  const titles = new Map(projects.map((project) => [project._id.toHexString(), project.title]))
  const notifications = page.map((record) => presentNotification(record, titles))
  return { notifications, unreadCount: await unreadNotificationCount(db, recipientId, now), nextCursor: records.length > NOTIFICATION_PAGE_SIZE ? encodeCursor(page[page.length - 1]) : null, cutoff: now.toISOString() }
}

export async function markNotificationRead(db: Db, recipientId: string, id: string, now = new Date()): Promise<boolean> {
  if (!/^[a-f\d]{24}$/i.test(id)) return false
  await ensureNotificationIndexes(db)
  const result = await db.collection<StoredNotification>("notifications").updateOne({ _id: new ObjectId(id), recipientId, readAt: null, expiresAt: { $gt: now } }, { $set: { readAt: now } })
  return result.matchedCount === 1
}

export async function markNotificationsRead(db: Db, recipientId: string, cutoff: Date, now = new Date()): Promise<number> {
  await ensureNotificationIndexes(db)
  const result = await db.collection<StoredNotification>("notifications").updateMany({ recipientId, readAt: null, expiresAt: { $gt: now }, updatedAt: { $lte: cutoff } }, { $set: { readAt: now } })
  return result.modifiedCount
}

export async function readNotificationPreferences(db: Db, recipientId: string) {
  await ensureNotificationIndexes(db)
  const stored = await db.collection<{ email?: Partial<Record<EmailPreferenceKey, boolean>> }>("notificationPreferences").findOne({ recipientId }, { projection: { email: 1 } })
  return { email: { ...defaultEmailPreferences, ...stored?.email }, essentialSecurityEmail: true }
}

export async function updateNotificationPreferences(db: Db, recipientId: string, email: Partial<Record<EmailPreferenceKey, boolean>>) {
  await ensureNotificationIndexes(db)
  const current = await readNotificationPreferences(db, recipientId)
  const next = { ...current.email }
  for (const key of Object.keys(defaultEmailPreferences) as EmailPreferenceKey[]) {
    if (typeof email[key] === "boolean") next[key] = email[key]
  }
  await db.collection("notificationPreferences").updateOne({ recipientId }, { $set: { recipientId, email: next, updatedAt: new Date() } }, { upsert: true })
  return { email: next, essentialSecurityEmail: true }
}
