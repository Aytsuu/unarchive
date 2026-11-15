import { auth } from "@/lib/auth"
import { isLegalAdmin } from "@/lib/legal/admin"
import { listContentReports } from "@/lib/legal/report-store"
import { db } from "@/lib/mongodb"

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return Response.json({ success: false, error: "Please sign in." }, { status: 401, headers: { "Cache-Control": "no-store" } })
  if (!isLegalAdmin(session.user.email)) return Response.json({ success: false, error: "Not found." }, { status: 404, headers: { "Cache-Control": "no-store" } })
  try {
    const reports = await listContentReports(db)
    return Response.json({ success: true, data: { reports } }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    console.error("Could not list content reports")
    return Response.json({ success: false, error: "Unable to load reports." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
