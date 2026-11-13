import { ObjectId } from "mongodb"
import { connection } from "next/server"
import { db } from "@/lib/mongodb"

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await context.params
  const headers = { "Cache-Control": "no-store" }
  if (!/^[a-f\d]{24}$/i.test(id)) return Response.json({ success: false, error: "Project not found." }, { status: 404, headers })
  const rawBefore = new URL(request.url).searchParams.get("before")
  const before = rawBefore === null ? null : Number(rawBefore)
  if (rawBefore !== null && (!/^\d+$/.test(rawBefore) || !Number.isSafeInteger(before) || before! < 1)) return Response.json({ success: false, error: "Invalid version cursor." }, { status: 400, headers })
  try {
    const projectId = new ObjectId(id)
    const project = await db.collection<{ withdrawnAt?: Date }>("projects").findOne({ _id: projectId }, { projection: { withdrawnAt: 1 }, maxTimeMS: 3000 })
    if (!project) return Response.json({ success: false, error: "Project not found." }, { status: 404, headers })
    if (project.withdrawnAt) return Response.json({ success: false, error: "This project has been withdrawn." }, { status: 410, headers })
    const records = await db.collection<{ projectId: ObjectId; version: number; kind: string; capturedAt: Date }>("projectVersions").find({ projectId, ...(before === null ? {} : { version: { $lt: before } }) }, { projection: { version: 1, kind: 1, capturedAt: 1 }, maxTimeMS: 3000 }).sort({ version: -1 }).limit(101).toArray()
    const versions = records.slice(0, 100).map(({ version, kind, capturedAt }) => ({ version, kind, capturedAt: capturedAt.toISOString() }))
    return Response.json({ success: true, data: { versions, nextBefore: records.length > 100 ? versions.at(-1)?.version ?? null : null } }, { headers })
  } catch {
    console.error("Project version history could not be retrieved")
    return Response.json({ success: false, error: "Unable to load project versions." }, { status: 503, headers })
  }
}
