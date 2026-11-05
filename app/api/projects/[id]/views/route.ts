import { db } from "@/lib/mongodb"
import { authorizeMetricsWrite, metricsError, metricsSuccess } from "@/lib/projects/metrics-api"
import { recordProjectView } from "@/lib/projects/metrics"
import { viewIpFromHeaders } from "@/lib/projects/view-ip"

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const authorized = await authorizeMetricsWrite(request, (await context.params).id, "view")
    if (authorized.response) return authorized.response
    const ip = viewIpFromHeaders(request.headers, process.env.PROJECT_VIEWS_TRUST_PROXY_HEADER, process.env.NODE_ENV)
    const secret = process.env.BETTER_AUTH_SECRET
    if (!ip || !secret) return metricsError("Project view tracking is temporarily unavailable.", 503)
    return metricsSuccess({ views: await recordProjectView(db, authorized.projectId, ip, secret) })
  } catch {
    console.error("Project view could not be recorded")
    return metricsError("Unable to record the project view.", 500)
  }
}
