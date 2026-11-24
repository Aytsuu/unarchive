import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { listNotifications, unreadNotificationCount } from "@/lib/notifications/inbox"
import { metricsError, metricsSuccess } from "@/lib/projects/metrics-api"
import { sameOrigin } from "@/lib/legal/origin"
import { claimMetricsAttempt } from "@/lib/projects/metrics-rate-limit"

export async function GET(request: Request) {
  await connection()
  const url = new URL(request.url)
  const filter = url.searchParams.get("filter") ?? "all"
  const cursor = url.searchParams.get("cursor")
  const summary = url.searchParams.get("summary") === "1"
  if (filter !== "all" && filter !== "unread" && filter !== "action-required") return metricsError("Unknown notification filter.", 400)
  if (cursor !== null && cursor.length > 200) return metricsError("Invalid notification cursor.", 400)
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return metricsError("Please sign in to continue.", 401)
    const retryAfter = await claimMetricsAttempt(db, session.user.id, "notifications-list")
    if (retryAfter) return metricsError("Too many requests. Please try again later.", 429, { "Retry-After": String(retryAfter) })
    if (summary) {
      const now = new Date()
      return metricsSuccess({ notifications: [], unreadCount: await unreadNotificationCount(db, session.user.id, now), nextCursor: null, cutoff: now.toISOString() })
    }
    return metricsSuccess(await listNotifications(db, session.user.id, filter, cursor))
  } catch (error) {
    if (error instanceof Error && error.message === "invalid-cursor") return metricsError("Invalid notification cursor.", 400)
    console.error("Notifications could not be retrieved")
    return metricsError("Unable to load your notifications. Please try again.", 503)
  }
}

export async function POST(request: Request) {
  await connection()
  if (!sameOrigin(request)) return metricsError("Invalid request origin.", 403)
  let body: unknown
  try { body = await request.json() } catch { return metricsError("Invalid notification request.", 400) }
  if (!body || typeof body !== "object") return metricsError("Invalid notification request.", 400)
  const payload = body as { id?: unknown; all?: unknown; cutoff?: unknown }
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return metricsError("Please sign in to continue.", 401)
    const retryAfter = await claimMetricsAttempt(db, session.user.id, "notifications-write")
    if (retryAfter) return metricsError("Too many requests. Please try again later.", 429, { "Retry-After": String(retryAfter) })
    const { markNotificationRead, markNotificationsRead } = await import("@/lib/notifications/inbox")
    if (payload.all === true) {
      const cutoff = typeof payload.cutoff === "string" ? new Date(payload.cutoff) : new Date()
      if (Number.isNaN(cutoff.getTime()) || cutoff.getTime() > Date.now() + 60_000) return metricsError("Invalid notification cutoff.", 400)
      const updated = await markNotificationsRead(db, session.user.id, cutoff)
      return metricsSuccess({ updated })
    }
    if (typeof payload.id !== "string") return metricsError("Invalid notification request.", 400)
    const updated = await markNotificationRead(db, session.user.id, payload.id)
    if (!updated) return metricsError("Notification not found.", 404)
    return metricsSuccess({ updated: 1 })
  } catch {
    console.error("Notification read state could not be saved")
    return metricsError("Unable to update your notifications. Please try again.", 503)
  }
}
