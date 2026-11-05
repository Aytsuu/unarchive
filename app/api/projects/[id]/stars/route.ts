import { db } from "@/lib/mongodb"
import { authorizeMetricsWrite, metricsError, metricsSuccess } from "@/lib/projects/metrics-api"
import { setProjectStar } from "@/lib/projects/metrics"

async function setStar(request: Request, context: { params: Promise<{ id: string }> }, starred: boolean) {
  try {
    const authorized = await authorizeMetricsWrite(request, (await context.params).id, "star")
    if (authorized.response) return authorized.response
    return metricsSuccess(await setProjectStar(db, authorized.projectId, authorized.userId, starred))
  } catch {
    console.error("Project star could not be updated")
    return metricsError("Unable to update your star. Please try again.", 500)
  }
}

export function PUT(request: Request, context: { params: Promise<{ id: string }> }) { return setStar(request, context, true) }
export function DELETE(request: Request, context: { params: Promise<{ id: string }> }) { return setStar(request, context, false) }
