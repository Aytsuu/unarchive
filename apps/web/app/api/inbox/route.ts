import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { metricsError, metricsSuccess } from "@/lib/projects/metrics-api"
import { claimMetricsAttempt } from "@/lib/projects/metrics-rate-limit"
import { listInbox } from "@/lib/projects/proposals"

export async function GET(request: Request) {
  await connection()
  const cursor = new URL(request.url).searchParams.get("cursor")
  if (cursor !== null && !/^[a-f\d]{24}$/i.test(cursor)) return metricsError("Invalid inbox cursor.", 400)
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return metricsError("Please sign in to continue.", 401)
    const retryAfter = await claimMetricsAttempt(db, session.user.id, "inbox-list")
    if (retryAfter) return metricsError("Too many requests. Please try again later.", 429, { "Retry-After": String(retryAfter) })
    return metricsSuccess(await listInbox(db, session.user.id, cursor))
  } catch {
    console.error("Inbox proposals could not be retrieved")
    return metricsError("Unable to load your inbox. Please try again.", 503)
  }
}
