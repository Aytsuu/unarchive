import type { Db } from "mongodb"
import { PUBLISH_WEBHOOK_COLLECTION, PUBLISH_WEBHOOK_EVENT_TYPE } from "@unarchive/domain/submissions"

export const PUBLISH_WEBHOOK_MAX_ATTEMPTS = 8
const LEASE_MS = 30_000

export type PublishWebhookDelivery = {
  eventId: string
  type: typeof PUBLISH_WEBHOOK_EVENT_TYPE
  submissionId: string
  state: "pending" | "leased" | "delivered" | "dead"
  attempts: number
  nextAttemptAt: Date
  occurredAt: Date
  lastError?: string
  leaseOwner?: string
  leaseUntil?: Date
  deliveredAt?: Date
}

type WebhookFetch = (input: string, init: RequestInit) => Promise<Response>

export type PublishWebhookDeliveryOptions = {
  now?: Date
  fetch?: WebhookFetch
  url?: string
  secret?: string
  development?: boolean
  limit?: number
}

let reportedConfig = false

export function publishWebhookBackoffMs(attempts: number) {
  return Math.min(60 * 60 * 1000, 1000 * 2 ** attempts)
}

export function publishWebhookEndpoint(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("Publish webhook URL is invalid.")
  }
  if (parsed.protocol !== "https:") throw new Error("Publish webhook URL must use HTTPS.")
  return parsed
}

export async function deliverPublishWebhooks(db: Db, workerId: string, options: PublishWebhookDeliveryOptions = {}) {
  const development = options.development ?? process.env.NODE_ENV === "development"
  if (!development) return 0
  const url = (options.url ?? process.env.PUBLISH_WEBHOOK_URL ?? "").trim()
  const secret = options.secret ?? process.env.PUBLISH_WEBHOOK_SECRET ?? ""
  if (!url || !secret) {
    reportOnce("Publication webhooks are waiting for PUBLISH_WEBHOOK_URL and PUBLISH_WEBHOOK_SECRET.")
    return 0
  }
  let endpoint: URL
  try {
    endpoint = publishWebhookEndpoint(url)
  } catch (error) {
    reportOnce(error instanceof Error ? error.message : "Publish webhook URL is invalid.")
    return 0
  }
  await ensurePublishWebhookIndexes(db)
  const now = options.now ?? new Date()
  const send = options.fetch ?? fetch
  const limit = options.limit ?? 20
  let delivered = 0
  for (let index = 0; index < limit; index += 1) {
    const claimed = await claimDelivery(db, workerId, now)
    if (!claimed) break
    try {
      await postWebhook(send, endpoint, secret, claimed.submissionId)
      await finishDelivery(db, claimed, now)
      delivered += 1
    } catch (error) {
      await retryDelivery(db, claimed, now, deliveryError(error, secret))
    }
  }
  return delivered
}

async function ensurePublishWebhookIndexes(db: Db) {
  const collection = db.collection(PUBLISH_WEBHOOK_COLLECTION)
  await collection.createIndex({ eventId: 1 }, { unique: true, name: "publish_webhook_event_id" })
  await collection.createIndex({ state: 1, nextAttemptAt: 1 }, { name: "publish_webhook_claim" })
}

async function claimDelivery(db: Db, workerId: string, now: Date) {
  const claimed = await db.collection<PublishWebhookDelivery>(PUBLISH_WEBHOOK_COLLECTION).findOneAndUpdate(
    {
      state: { $in: ["pending", "leased"] },
      nextAttemptAt: { $lte: now },
      $or: [{ leaseUntil: { $exists: false } }, { leaseUntil: { $lte: now } }, { state: "pending" }],
    },
    { $set: { state: "leased", leaseOwner: workerId, leaseUntil: new Date(now.getTime() + LEASE_MS) }, $inc: { attempts: 1 } },
    { sort: { nextAttemptAt: 1 }, returnDocument: "after" },
  )
  if (!claimed?.eventId || !claimed.submissionId) return null
  return claimed
}

async function finishDelivery(db: Db, delivery: PublishWebhookDelivery, now: Date) {
  await db.collection<PublishWebhookDelivery>(PUBLISH_WEBHOOK_COLLECTION).updateOne(
    { eventId: delivery.eventId, leaseOwner: delivery.leaseOwner, state: "leased" },
    { $set: { state: "delivered", deliveredAt: now }, $unset: { leaseOwner: "", leaseUntil: "", lastError: "" } },
  )
}

async function retryDelivery(db: Db, delivery: PublishWebhookDelivery, now: Date, lastError: string) {
  const dead = delivery.attempts >= PUBLISH_WEBHOOK_MAX_ATTEMPTS
  const nextAttemptAt = dead ? now : new Date(now.getTime() + publishWebhookBackoffMs(delivery.attempts))
  await db.collection<PublishWebhookDelivery>(PUBLISH_WEBHOOK_COLLECTION).updateOne(
    { eventId: delivery.eventId, leaseOwner: delivery.leaseOwner, state: "leased" },
    {
      $set: dead ? { state: "dead", nextAttemptAt, lastError } : { state: "pending", nextAttemptAt, lastError },
      $unset: { leaseOwner: "", leaseUntil: "" },
    },
  )
}

async function postWebhook(send: WebhookFetch, endpoint: URL, secret: string, submissionId: string) {
  const response = await send(endpoint.toString(), {
    method: "POST",
    redirect: "error",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ type: PUBLISH_WEBHOOK_EVENT_TYPE, submissionId }),
  })
  if (response.ok) return
  const body = await response.text().catch(() => "")
  const error = new Error(`HTTP ${response.status}`)
  error.cause = body
  throw error
}

function deliveryError(error: unknown, secret: string) {
  const message = error instanceof Error ? error.message : "The webhook request failed."
  const cause = error instanceof Error && typeof error.cause === "string" ? error.cause : ""
  const text = cause ? `${message}: ${cause}` : message
  return redact(text, secret).slice(0, 500)
}

function redact(text: string, secret: string) {
  if (!secret) return text
  return text.split(secret).join("[redacted]")
}

function reportOnce(message: string) {
  if (reportedConfig) return
  reportedConfig = true
  console.error(message)
}
