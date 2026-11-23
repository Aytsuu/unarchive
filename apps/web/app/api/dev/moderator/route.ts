import { grantModeratorAccess, hasModeratorAccess } from "@unarchive/domain/access"
import { auth } from "@/lib/auth"
import { isLocalDevelopmentRequest } from "@/lib/dev-autofill"
import { db } from "@/lib/mongodb"

const headers = { "Cache-Control": "no-store" }

export async function GET(request: Request) {
  if (!isLocalDevelopmentRequest(request)) return new Response(null, { status: 404 })
  const session = await auth.api.getSession({ headers: request.headers })
  const granted = session?.user?.id ? await hasModeratorAccess(db, session.user.id) : false
  return Response.json({ granted }, { headers })
}

export async function POST(request: Request) {
  if (!isLocalDevelopmentRequest(request)) return new Response(null, { status: 404 })
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user?.id) return Response.json({ error: "Sign in first." }, { status: 401, headers })
  try {
    await grantModeratorAccess(db, session.user.id)
  } catch {
    console.error("Could not grant development moderator access")
    return Response.json({ error: "Could not grant moderator access." }, { status: 500, headers })
  }
  return Response.json({ success: true }, { headers })
}
