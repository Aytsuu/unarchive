import { auth } from "@/lib/auth"
import { recordTermsAcceptance } from "@/lib/legal/acceptances"
import { ensureLegalDocuments } from "@/lib/legal/documents"
import { sameOrigin } from "@/lib/legal/origin"
import { db } from "@/lib/mongodb"

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ success: false, error: "Invalid request origin." }, { status: 403, headers: { "Cache-Control": "no-store" } })
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return Response.json({ success: false, error: "Please sign in." }, { status: 401, headers: { "Cache-Control": "no-store" } })
  try {
    await ensureLegalDocuments(db)
    const result = await recordTermsAcceptance(db, { userId: session.user.id, method: "explicit" })
    return Response.json({ success: true, data: result }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    console.error("Could not record terms acceptance")
    return Response.json({ success: false, error: "Unable to record Terms acceptance." }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }
}
