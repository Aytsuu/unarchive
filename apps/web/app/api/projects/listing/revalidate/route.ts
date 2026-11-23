import { revalidateTag } from "next/cache"
import { hasModeratorAccess } from "@unarchive/domain/access"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { sameOrigin } from "@/lib/legal/origin"
import { PROJECT_LIST_TAG } from "@/lib/projects/listing"

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ success: false, error: "Invalid request origin." }, { status: 403, headers: { "Cache-Control": "no-store" } })
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return Response.json({ success: false, error: "Please sign in." }, { status: 401, headers: { "Cache-Control": "no-store" } })
  if (!await hasModeratorAccess(db, session.user.id)) return Response.json({ success: false, error: "Moderator access is required." }, { status: 403, headers: { "Cache-Control": "no-store" } })
  try { revalidateTag(PROJECT_LIST_TAG, { expire: 0 }) } catch { console.error("Project listing cache invalidation failed") }
  return Response.json({ success: true }, { headers: { "Cache-Control": "no-store" } })
}
