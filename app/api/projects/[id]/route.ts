import { createHash } from "node:crypto"
import { ObjectId } from "mongodb"
import { revalidateTag } from "next/cache"
import { auth } from "@/lib/auth"
import { db, mongoClient } from "@/lib/mongodb"
import { PROJECT_LIST_TAG } from "@/lib/projects/listing"
import { claimProjectAttempt } from "@/lib/projects/rate-limit"
import { ProjectValidationError, parseProject } from "@/lib/projects/validation"
import { InvalidProjectEditError, parseEditKey, parseEditPayload } from "@/lib/projects/version-edit.mjs"
import { captureLegacyBaseline, createProjectVersion, ProjectIdempotencyConflictError, ProjectNotFoundError, ProjectReferenceNotFoundError, ProjectVersionConflictError } from "@/lib/projects/versions"

const MAX_BODY_BYTES = 64 * 1024
const headers = { "Cache-Control": "no-store" }
function failure(error: string, status: number, extra?: Record<string, string>) {
  return Response.json({ success: false, error }, { status, headers: { ...headers, ...extra } })
}
function invalidateListing() {
  try { revalidateTag(PROJECT_LIST_TAG, { expire: 0 }) } catch { console.error("Project listing cache invalidation failed") }
}
function validId(id: string) { return /^[a-f\d]{24}$/i.test(id) }
function expectedOrigin(request: Request) {
  try { return new URL(process.env.BETTER_AUTH_URL ?? request.url).origin } catch { return null }
}
async function readJson(request: Request): Promise<unknown> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) throw new InvalidProjectEditError("Send project details as JSON.")
  const length = request.headers.get("content-length")
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) throw new InvalidProjectEditError("Project details are too large.")
  if (!request.body) throw new InvalidProjectEditError("Project details are required.")
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const result = await reader.read()
      if (result.done) break
      size += result.value.byteLength
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new InvalidProjectEditError("Project details are too large.") }
      chunks.push(result.value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) } catch { throw new InvalidProjectEditError("Invalid JSON project details.") }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!validId(id)) return failure("Project not found.", 404)
  const origin = expectedOrigin(request)
  if (!origin) return failure("Editing is temporarily unavailable.", 503)
  if (request.headers.get("origin") !== origin) return failure("Invalid request origin.", 403)
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return failure("Please sign in to edit.", 401)
    const retryAfter = await claimProjectAttempt(db, session.user.id)
    if (retryAfter) return failure("Too many project attempts. Please try again later.", 429, { "Retry-After": String(retryAfter) })
    const editKey = parseEditKey(request.headers.get("idempotency-key"))
    const { expectedVersion, project } = parseEditPayload(await readJson(request), parseProject)
    if (project.referenceProjectIds?.includes(id.toLowerCase())) return failure("A project cannot reference itself.", 400)
    const projectId = new ObjectId(id)
    const existing = await db.collection<{ ownerId: string; demos?: string[]; currentVersion?: number }>("projects").findOne({ _id: projectId, ownerId: session.user.id, withdrawnAt: { $exists: false } }, { projection: { demos: 1, currentVersion: 1 }, maxTimeMS: 3000 })
    if (!existing) return failure("Project not found.", 404)
    if (existing.currentVersion == null) await captureLegacyBaseline(mongoClient, db, projectId)
    const editDigest = createHash("sha256").update(JSON.stringify({ expectedVersion, project })).digest("hex")
    const result = await createProjectVersion(mongoClient, db, { projectId, ownerId: session.user.id, expectedVersion, project, demos: existing.demos ?? [], editKey, editDigest })
    invalidateListing()
    return Response.json({ success: true, data: { id: projectId.toHexString(), version: result.version, replayed: result.replayed } }, { headers })
  } catch (error) {
    if (error instanceof ProjectNotFoundError) return failure("Project not found.", 404)
    if (error instanceof ProjectVersionConflictError || error instanceof ProjectIdempotencyConflictError) return failure(error.message, 409)
    if (error instanceof InvalidProjectEditError || error instanceof ProjectValidationError || error instanceof ProjectReferenceNotFoundError) return failure(error.message, 400)
    console.error("Project edit failed")
    return failure("Unable to save your project right now. Please try again.", 503)
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params
  if (!validId(id)) return failure("Project not found.", 404)
  const origin = expectedOrigin(request)
  if (!origin) return failure("Withdrawal is temporarily unavailable.", 503)
  if (request.headers.get("origin") !== origin) return failure("Invalid request origin.", 403)
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return failure("Please sign in to withdraw.", 401)
    const retryAfter = await claimProjectAttempt(db, session.user.id)
    if (retryAfter) return failure("Too many project attempts. Please try again later.", 429, { "Retry-After": String(retryAfter) })
    const projectId = new ObjectId(id)
    const projects = db.collection<{ ownerId: string; withdrawnAt?: Date }>("projects")
    const now = new Date()
    const result = await projects.updateOne({ _id: projectId, ownerId: session.user.id, withdrawnAt: { $exists: false } }, { $set: { withdrawnAt: now } })
    if (!result.matchedCount && !await projects.findOne({ _id: projectId, ownerId: session.user.id, withdrawnAt: { $exists: true } }, { projection: { _id: 1 }, maxTimeMS: 3000 })) return failure("Project not found.", 404)
    invalidateListing()
    return Response.json({ success: true, data: { id: projectId.toHexString(), withdrawn: true } }, { headers })
  } catch {
    console.error("Project withdrawal failed")
    return failure("Unable to withdraw your project right now. Please try again.", 503)
  }
}
