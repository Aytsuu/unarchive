import { ObjectId, type Db, type WithId } from "mongodb"
import { Resend } from "resend"

type ModerationType = "project.publish_approved" | "project.revision_requested"
type ModerationEvent = { eventId: string; type: ModerationType; recipientId: string; submissionId: string; projectId: string; occurredAt: Date }
type EmailJob = ModerationEvent & {
  state: "pending" | "leased" | "accepted" | "skipped" | "dead"
  attempts: number
  nextAttemptAt: Date
  leaseOwner?: string
  leaseUntil?: Date
  firstAttemptAt?: Date
  address?: string
}
type Message = { to: string; subject: string; text: string; idempotencyKey: string }
type EmailTransport = (message: Message) => Promise<void>

const ID = /^[a-f\d]{24}$/i
const LEASE_MS = 60_000
const IDEMPOTENCY_WINDOW_MS = 23 * 60 * 60 * 1000
const MAX_ATTEMPTS = 8
const indexes = new WeakMap<Db, Promise<void>>()

async function ensureIndexes(db: Db) {
  let pending = indexes.get(db)
  if (!pending) {
    pending = Promise.all([
      db.collection<EmailJob>("notificationDeliveries").createIndex({ eventId: 1, recipientId: 1, channel: 1 }, { unique: true, name: "moderation_email_delivery_unique" }),
      db.collection<EmailJob>("notificationDeliveries").createIndex({ channel: 1, state: 1, nextAttemptAt: 1 }, { name: "moderation_email_claim" }),
    ]).then(() => undefined).catch((error: unknown) => { indexes.delete(db); throw error })
    indexes.set(db, pending)
  }
  await pending
}

export function moderationEmailContent(event: Pick<ModerationEvent, "type" | "submissionId" | "projectId">, baseURL: string) {
  if (!ID.test(event.submissionId) || !ID.test(event.projectId)) throw new Error("Invalid moderation target")
  const origin = new URL(baseURL)
  if (origin.username || origin.password || (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname)))) throw new Error("Invalid application URL")
  const revision = event.type === "project.revision_requested"
  const url = new URL(revision ? `/submissions/${event.submissionId}` : `/projects/${event.projectId}`, origin.origin).toString()
  return revision
    ? { subject: "Revisions requested for your submission", text: `A moderator requested revisions to your project submission. Sign in to review the feedback and resubmit:\n\n${url}` }
    : { subject: "Your project has been published", text: `Your project submission was approved and published. View your project:\n\n${url}` }
}

export async function enqueueModerationEmail(db: Db, event: ModerationEvent): Promise<void> {
  await ensureIndexes(db)
  await db.collection<EmailJob>("notificationDeliveries").updateOne(
    { eventId: event.eventId, recipientId: event.recipientId, channel: "email" },
    { $setOnInsert: { ...event, channel: "email", state: "pending", attempts: 0, nextAttemptAt: new Date() } },
    { upsert: true },
  )
}

async function sendResend(message: Message): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.EMAIL_FROM
  if (!apiKey || !from) throw new Error("Email delivery is not configured")
  const { error } = await new Resend(apiKey).emails.send({ from, to: message.to, subject: message.subject, text: message.text }, { idempotencyKey: message.idempotencyKey })
  if (error) throw new Error("Email provider did not accept message")
}

async function complete(db: Db, job: WithId<EmailJob>, workerId: string, state: "accepted" | "skipped" | "dead", now: Date) {
  await db.collection<EmailJob>("notificationDeliveries").updateOne(
    { _id: job._id, state: "leased", leaseOwner: workerId },
    { $set: { state, completedAt: now }, $unset: { leaseOwner: "", leaseUntil: "", address: "" } },
  )
}

export async function processModerationEmails(db: Db, workerId: string, options: { limit?: number; now?: () => Date; send?: EmailTransport; baseURL?: string } = {}): Promise<number> {
  await ensureIndexes(db)
  const clock = options.now ?? (() => new Date())
  let processed = 0
  for (let i = 0; i < (options.limit ?? 20); i++) {
    const now = clock()
    const job = await db.collection<EmailJob>("notificationDeliveries").findOneAndUpdate(
      { channel: "email", type: { $in: ["project.publish_approved", "project.revision_requested"] }, nextAttemptAt: { $lte: now }, $or: [{ state: "pending" }, { state: "leased", leaseUntil: { $lte: now } }] },
      { $set: { state: "leased", leaseOwner: workerId, leaseUntil: new Date(now.getTime() + LEASE_MS) }, $inc: { attempts: 1 } },
      { sort: { nextAttemptAt: 1 }, returnDocument: "after" },
    )
    if (!job) break
    try {
      const key = job.type === "project.publish_approved" ? "publishApproved" : "revisionRequested"
      const preference = await db.collection<{ email?: Record<string, boolean> }>("notificationPreferences").findOne({ recipientId: job.recipientId })
      const userId = ID.test(job.recipientId) ? { $in: [job.recipientId, new ObjectId(job.recipientId)] } : job.recipientId
      const user = await db.collection<{ _id: ObjectId | string; email?: string; emailVerified?: boolean }>("user").findOne({ _id: userId })
      const address = user?.email?.trim()
      if (preference?.email?.[key] === false || !address || user?.emailVerified !== true || (job.address && job.address !== address)) {
        await complete(db, job, workerId, "skipped", now)
      } else if (job.firstAttemptAt && now.getTime() - job.firstAttemptAt.getTime() >= IDEMPOTENCY_WINDOW_MS) {
        await complete(db, job, workerId, "dead", now)
        console.error("Moderation email requires operator review after retry window")
      } else {
        const content = moderationEmailContent(job, options.baseURL ?? process.env.WEB_APP_URL ?? process.env.BETTER_AUTH_URL ?? "")
        const claimed = await db.collection<EmailJob>("notificationDeliveries").updateOne(
          { _id: job._id, state: "leased", leaseOwner: workerId },
          { $set: { address, firstAttemptAt: job.firstAttemptAt ?? now } },
        )
        if (!claimed.matchedCount) continue
        await (options.send ?? sendResend)({ to: address, ...content, idempotencyKey: `moderation/${job._id.toHexString()}` })
        await complete(db, job, workerId, "accepted", clock())
      }
      processed++
    } catch {
      const dead = job.attempts >= MAX_ATTEMPTS
      await db.collection<EmailJob>("notificationDeliveries").updateOne(
        { _id: job._id, state: "leased", leaseOwner: workerId },
        { $set: { state: dead ? "dead" : "pending", nextAttemptAt: new Date(now.getTime() + Math.min(60 * 60_000, 1000 * 2 ** job.attempts)) }, $unset: { leaseOwner: "", leaseUntil: "" } },
      )
      console.error(dead ? "Moderation email repeatedly failed; operator review required" : "Moderation email delivery failed; retry scheduled")
    }
  }
  return processed
}
