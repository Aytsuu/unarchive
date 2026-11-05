import { ObjectId } from "mongodb"
import { db } from "@/lib/mongodb"
import { getProjectDemo } from "@/lib/project-storage"
import { auth } from "@/lib/auth"

export async function GET(request: Request, context: { params: Promise<{ id: string; index: string }> }) {
  const { id, index } = await context.params
  if (!/^[a-f\d]{24}$/i.test(id) || !/^[0-4]$/.test(index)) return new Response(null, { status: 404 })
  try {
    if (!await auth.api.getSession({ headers: request.headers })) return new Response(null, { status: 401, headers: { "Cache-Control": "no-store" } })
    const project = await db.collection<{ demos?: string[] }>("projects").findOne({ _id: new ObjectId(id) }, { projection: { demos: 1 } })
    const key = project?.demos?.[Number(index)]
    if (!key) return new Response(null, { status: 404 })
    const image = await getProjectDemo(key)
    return new Response(image.stream, { headers: { "Content-Type": image.contentType, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600", "Vary": "Cookie" } })
  } catch {
    console.error("Project demo could not be retrieved")
    return new Response(null, { status: 503 })
  }
}
