import { auth } from "@/lib/auth"
import { hasAcceptedCurrentTerms } from "@/lib/legal/acceptances"
import { CURRENT_TERMS_VERSION } from "@/lib/legal/policy"
import { db } from "@/lib/mongodb"

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return Response.json({ success: false, error: "Please sign in." }, { status: 401, headers: { "Cache-Control": "no-store" } })
  try {
    const accepted = await hasAcceptedCurrentTerms(db, session.user.id)
    return Response.json({ success: true, data: { accepted, version: CURRENT_TERMS_VERSION } }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    console.error("Could not read terms acceptance")
    return Response.json({ success: false, error: "Unable to check Terms acceptance." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
