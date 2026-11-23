import { auth } from "@/lib/auth"
import { connection } from "next/server"
import { db } from "@/lib/mongodb"
import { claimReferenceSearch, parseReferenceQuery, searchReferenceProjects } from "@/lib/projects/reference-search"

function failure(error: string, status: number, headers?: Record<string, string>) {
  return Response.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

export async function GET(request: Request) {
  await connection()
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return failure("Please sign in to search projects.", 401)
    const query = parseReferenceQuery(new URL(request.url).searchParams.get("q"))
    if (query === null) return failure("Enter a search of up to 100 characters.", 400)
    const retryAfter = await claimReferenceSearch(db, session.user.id)
    if (retryAfter) return failure("Too many searches. Please try again later.", 429, { "Retry-After": String(retryAfter) })
    const projects = await searchReferenceProjects(db, query)
    return Response.json({ success: true, data: { projects } }, { headers: { "Cache-Control": "no-store" } })
  } catch {
    console.error("Project reference search failed")
    return failure("Unable to search projects right now. Please try again.", 500)
  }
}
