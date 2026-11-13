import { ObjectId } from "mongodb"
import { connection } from "next/server"
import { db } from "@/lib/mongodb"
import { getProjectDemo } from "@/lib/project-storage"

export async function GET(_request: Request, context: { params: Promise<{ id: string; version: string; index: string }> }) {
  await connection()
  const { id, version, index } = await context.params
  const number = Number(version)
  if (!/^[a-f\d]{24}$/i.test(id) || !/^[1-9]\d*$/.test(version) || !Number.isSafeInteger(number) || !/^[0-4]$/.test(index)) return new Response(null, { status: 404 })
  try {
    const projectId = new ObjectId(id)
    const project = await db.collection<{ withdrawnAt?: Date }>("projects").findOne({ _id: projectId }, { projection: { withdrawnAt: 1 }, maxTimeMS: 3000 })
    if (!project) return new Response(null, { status: 404 })
    if (project.withdrawnAt) return new Response(null, { status: 410, headers: { "Cache-Control": "no-store" } })
    const record = await db.collection<{ projectId: ObjectId; version: number; snapshot: { demos?: string[] } }>("projectVersions").findOne({ projectId, version: number }, { projection: { "snapshot.demos": 1 }, maxTimeMS: 3000 })
    const key = record?.snapshot?.demos?.[Number(index)]
    if (!key) return new Response(null, { status: 404 })
    const image = await getProjectDemo(key)
    return new Response(image.stream, { headers: { "Content-Type": image.contentType, "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store" } })
  } catch {
    console.error("Versioned project demo could not be retrieved")
    return new Response(null, { status: 503 })
  }
}
