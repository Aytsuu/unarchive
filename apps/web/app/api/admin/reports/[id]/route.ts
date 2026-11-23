import { ObjectId } from "mongodb"
import { revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { isLegalAdmin } from "@/lib/legal/admin"
import { sameOrigin } from "@/lib/legal/origin"
import { updateContentReport } from "@/lib/legal/report-store"
import { db } from "@/lib/mongodb"
import { PROJECT_LIST_TAG } from "@/lib/projects/listing"

const headers = { "Cache-Control": "no-store" as const }
function failure(error: string, status: number) {
  return Response.json({ success: false, error }, { status, headers })
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return failure("Invalid request origin.", 403)
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return failure("Please sign in.", 401)
  if (!isLegalAdmin(session.user.email)) return failure("Not found.", 404)
  const { id } = await context.params
  try {
    const raw: unknown = await request.json()
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return failure("Invalid request details.", 400)
    const data = raw as Record<string, unknown>
    const status = data.status
    if (status !== "open" && status !== "reviewing" && status !== "resolved" && status !== "rejected") return failure("Choose a valid status.", 400)
    const report = await updateContentReport(db, id, { status, ...(typeof data.resolution === "string" ? { resolution: data.resolution.trim().slice(0, 2000) } : {}) })
    if (!report) return failure("Report not found.", 404)
    if (data.restrictProject === true && report.projectId && /^[a-f\d]{24}$/i.test(report.projectId)) {
      await db.collection("projects").updateOne({ _id: new ObjectId(report.projectId), withdrawnAt: { $exists: false } }, { $set: { withdrawnAt: new Date() } })
      try { revalidateTag(PROJECT_LIST_TAG, { expire: 0 }) } catch { console.error("Project listing cache invalidation failed") }
    }
    if (Array.isArray(data.contributors) && report.projectId && /^[a-f\d]{24}$/i.test(report.projectId)) {
      if (data.contributors.length > 50 || data.contributors.some((name) => typeof name !== "string" || !name.trim() || name.trim().length > 200)) {
        return failure("Contributor names must be text of at most 200 characters.", 400)
      }
      await db.collection("projects").updateOne(
        { _id: new ObjectId(report.projectId) },
        { $set: { contributors: data.contributors.map((name) => (name as string).trim()), updatedAt: new Date() } },
      )
    }
    return Response.json({ success: true, data: { id, status: report.status } }, { headers })
  } catch {
    console.error("Could not update content report")
    return failure("Unable to update this report.", 503)
  }
}
