import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { getProjectDemo } from "@/lib/project-storage"
import { ownerSubmission } from "@/lib/projects/revision-submission"

export async function GET(request: Request, { params }: { params: Promise<{ id: string; index: string }> }) {
  const notFound = () => new Response(null, { status: 404, headers: { "Cache-Control": "private, no-store" } })
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return notFound()
  const { id, index } = await params
  if (!/^[0-4]$/.test(index)) return notFound()
  const submission = await ownerSubmission(db, id, session.user.id)
  const key = submission?.snapshot?.demos?.[Number(index)]
  if (typeof key !== "string") return notFound()
  try {
    const image = await getProjectDemo(key)
    return new Response(image.stream, { headers: { "Content-Type": image.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } })
  } catch {
    console.error("Submission image could not be retrieved")
    return new Response(null, { status: 503, headers: { "Cache-Control": "private, no-store" } })
  }
}
