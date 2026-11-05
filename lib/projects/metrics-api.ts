import { ObjectId } from "mongodb"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { claimMetricsAttempt } from "@/lib/projects/metrics-rate-limit"

export function metricsError(error: string, status: number, headers?: Record<string, string>) {
  return Response.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

export async function authorizeMetricsWrite(request: Request, id: string, action: "view" | "star") {
  if (!/^[a-f\d]{24}$/i.test(id)) return { response: metricsError("Project not found.", 404) }
  let expectedOrigin: string
  try { expectedOrigin = new URL(process.env.BETTER_AUTH_URL ?? request.url).origin } catch { return { response: metricsError("Project metrics are temporarily unavailable.", 503) } }
  if (request.headers.get("origin") !== expectedOrigin) return { response: metricsError("Invalid request origin.", 403) }
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return { response: metricsError("Please sign in to continue.", 401) }
  const projectId = new ObjectId(id)
  const exists = await db.collection("projects").findOne({ _id: projectId }, { projection: { _id: 1 }, maxTimeMS: 3000 })
  if (!exists) return { response: metricsError("Project not found.", 404) }
  const retryAfter = await claimMetricsAttempt(db, session.user.id, action)
  if (retryAfter) return { response: metricsError("Too many requests. Please try again later.", 429, { "Retry-After": String(retryAfter) }) }
  return { userId: session.user.id, projectId }
}

export function metricsSuccess(data: object) {
  return Response.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } })
}
