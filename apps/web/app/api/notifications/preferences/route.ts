import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { readNotificationPreferences, updateNotificationPreferences } from "@/lib/notifications/inbox"
import { defaultEmailPreferences, type EmailPreferenceKey } from "@/lib/notifications/policy"
import { metricsError, metricsSuccess } from "@/lib/projects/metrics-api"
import { sameOrigin } from "@/lib/legal/origin"
import { claimMetricsAttempt } from "@/lib/projects/metrics-rate-limit"

async function sessionUser(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  return session?.user.id ?? null
}

export async function GET(request: Request) {
  await connection()
  try {
    const userId = await sessionUser(request)
    if (!userId) return metricsError("Please sign in to continue.", 401)
    const retryAfter = await claimMetricsAttempt(db, userId, "notifications-list")
    if (retryAfter) return metricsError("Too many requests. Please try again later.", 429, { "Retry-After": String(retryAfter) })
    return metricsSuccess(await readNotificationPreferences(db, userId))
  } catch {
    console.error("Notification preferences could not be retrieved")
    return metricsError("Unable to load notification settings. Please try again.", 503)
  }
}

export async function PATCH(request: Request) {
  await connection()
  if (!sameOrigin(request)) return metricsError("Invalid request origin.", 403)
  let body: unknown
  try { body = await request.json() } catch { return metricsError("Invalid notification settings.", 400) }
  if (!body || typeof body !== "object" || !("email" in body) || !body.email || typeof body.email !== "object") return metricsError("Invalid notification settings.", 400)
  const email: Partial<Record<EmailPreferenceKey, boolean>> = {}
  for (const key of Object.keys(defaultEmailPreferences) as EmailPreferenceKey[]) {
    const value = (body.email as Record<string, unknown>)[key]
    if (value !== undefined && typeof value !== "boolean") return metricsError("Invalid notification settings.", 400)
    if (typeof value === "boolean") email[key] = value
  }
  try {
    const userId = await sessionUser(request)
    if (!userId) return metricsError("Please sign in to continue.", 401)
    const retryAfter = await claimMetricsAttempt(db, userId, "notifications-write")
    if (retryAfter) return metricsError("Too many requests. Please try again later.", 429, { "Retry-After": String(retryAfter) })
    return metricsSuccess(await updateNotificationPreferences(db, userId, email))
  } catch {
    console.error("Notification preferences could not be saved")
    return metricsError("Unable to save notification settings. Please try again.", 503)
  }
}
