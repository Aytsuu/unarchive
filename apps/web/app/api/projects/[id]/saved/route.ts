import { ObjectId } from "mongodb"
import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { authorizeMetricsWrite, metricsError, metricsSuccess } from "@/lib/projects/metrics-api"
import { claimMetricsAttempt } from "@/lib/projects/metrics-rate-limit"
import { getProjectSaved, setProjectSaved } from "@/lib/projects/saved"

type Context = { params: Promise<{ id: string }> }

export async function GET(request: Request, context: Context) {
  await connection()
  const { id } = await context.params
  if (!/^[a-f\d]{24}$/i.test(id)) return metricsError("Project not found.", 404)
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return metricsError("Please sign in to continue.", 401)
    const retryAfter = await claimMetricsAttempt(db, session.user.id, "saved-status")
    if (retryAfter) return metricsError("Too many requests. Please try again later.", 429, { "Retry-After": String(retryAfter) })
    const projectId = new ObjectId(id)
    const exists = await db.collection("projects").findOne({ _id: projectId, withdrawnAt: { $exists: false } }, { projection: { _id: 1 }, maxTimeMS: 3000 })
    if (!exists) return metricsError("Project not found.", 404)
    return metricsSuccess({ saved: await getProjectSaved(db, projectId, session.user.id) })
  } catch {
    console.error("Project save status could not be retrieved")
    return metricsError("Unable to load your saved project.", 503)
  }
}

async function setSaved(request: Request, context: Context, saved: boolean) {
  try {
    const authorized = await authorizeMetricsWrite(request, (await context.params).id, "save")
    if (authorized.response) return authorized.response
    return metricsSuccess(await setProjectSaved(db, authorized.projectId, authorized.userId, saved))
  } catch {
    console.error("Project save could not be updated")
    return metricsError("Unable to update your saved project. Please try again.", 500)
  }
}

export function PUT(request: Request, context: Context) { return setSaved(request, context, true) }
export function DELETE(request: Request, context: Context) { return setSaved(request, context, false) }
