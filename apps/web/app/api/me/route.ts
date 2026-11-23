import { auth } from "@/lib/auth"

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })

  if (!session) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    )
  }

  const { id, name, email, emailVerified, image } = session.user
  return Response.json(
    { user: { id, name, email, emailVerified, image } },
    { headers: { "Cache-Control": "private, no-store" } },
  )
}
