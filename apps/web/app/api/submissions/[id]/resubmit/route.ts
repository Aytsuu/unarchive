import { createHash } from "node:crypto"
import { ObjectId } from "mongodb"
import { resubmitSubmission } from "@unarchive/domain/submissions"
import { auth } from "@/lib/auth"
import { db, mongoClient } from "@/lib/mongodb"
import { sameOrigin } from "@/lib/legal/origin"
import { ensureLegalDocuments } from "@/lib/legal/documents"
import { hasAcceptedCurrentTerms } from "@/lib/legal/acceptances"
import { claimProjectAttempt } from "@/lib/projects/rate-limit"
import { getSubmissionIdentity, InvalidIdempotencyKeyError } from "@/lib/projects/idempotency"
import { ownerSubmission, retainedDemoIndexes } from "@/lib/projects/revision-submission"
import { parseProject, ProjectValidationError } from "@/lib/projects/validation"
import { deleteProjectDemos, saveProjectDemos, ProjectStorageValidationError } from "@/lib/project-storage"

const MAX_BODY = 26 * 1024 * 1024
const failure = (error: string, status: number) => Response.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store" } })

async function readForm(request: Request): Promise<FormData> {
  if (!/^multipart\/form-data\s*;/i.test(request.headers.get("content-type") ?? "") || !request.body) throw new ProjectValidationError("Invalid submission.")
  const length = request.headers.get("content-length")
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY)) throw new ProjectValidationError("Upload is too large.")
  const reader = request.body.getReader()
  const parts: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      total += value.byteLength
      if (total > MAX_BODY) { await reader.cancel(); throw new ProjectValidationError("Upload is too large.") }
      parts.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const part of parts) { bytes.set(part, offset); offset += part.length }
  try { return await new Response(bytes, { headers: { "content-type": request.headers.get("content-type")! } }).formData() }
  catch { throw new ProjectValidationError("Invalid submission.") }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(request)) return failure("Invalid request origin.", 403)
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session) return failure("Please sign in to continue.", 401)
  const { id } = await params
  try {
    await ensureLegalDocuments(db)
    if (!await hasAcceptedCurrentTerms(db, session.user.id)) return failure("Please accept the Terms & Conditions before resubmitting.", 403)
    const retryAfter = await claimProjectAttempt(db, session.user.id)
    if (retryAfter) return failure("Too many attempts. Please try again later.", 429)
    const prior = await ownerSubmission(db, id, session.user.id)
    if (!prior || prior.status !== "changes_requested") return failure("Submission not found.", 404)
    const form = await readForm(request)
    const metadata = form.getAll("project")
    const selection = form.getAll("retained")
    if (metadata.length !== 1 || typeof metadata[0] !== "string" || metadata[0].length > 65536 || selection.length !== 1 || typeof selection[0] !== "string" || selection[0].length > 100) return failure("Invalid submission.", 400)
    let raw: unknown, indexes: unknown
    try { raw = JSON.parse(metadata[0]); indexes = JSON.parse(selection[0]) } catch { return failure("Invalid submission.", 400) }
    const project = parseProject(raw)
    const oldDemos: string[] = Array.isArray(prior.snapshot?.demos) ? prior.snapshot.demos : []
    const retained = retainedDemoIndexes(indexes, oldDemos.length)
    const files = form.getAll("demos")
    if (!retained || files.some((file) => !(file instanceof File) || file.size === 0 || file.size > 5 * 1024 * 1024) || retained.length + files.length > 5) return failure("Choose up to five valid demo images.", 400)
    if (project.referenceProjectIds?.length) {
      const count = await db.collection("projects").countDocuments({ _id: { $in: project.referenceProjectIds.map((ref) => new ObjectId(ref)) }, withdrawnAt: { $exists: false } }, { maxTimeMS: 3000 })
      if (count !== project.referenceProjectIds.length) return failure("One or more reference projects no longer exist.", 400)
    }
    const identity = await getSubmissionIdentity(`${session.user.id}:${id}`, request.headers.get("idempotency-key") ?? "", project, files as File[])
    const digest = createHash("sha256").update(JSON.stringify([id, identity.digest, retained])).digest("hex")
    const existing = await db.collection("projectSubmissions").findOne({ _id: identity.id }, { projection: { ownerId: 1, idempotencyDigest: 1, previousSubmissionId: 1 } })
    if (existing) {
      if (existing.ownerId === session.user.id && existing.idempotencyDigest === digest && String(existing.previousSubmissionId) === id) return Response.json({ success: true, data: { id: identity.id.toHexString(), replayed: true } }, { headers: { "Cache-Control": "no-store" } })
      return failure("This submission key was already used for different content.", 409)
    }
    const uploaded = await saveProjectDemos(files as File[])
    try {
      const result = await resubmitSubmission(mongoClient, db, { previousId: id, id: identity.id, ownerId: session.user.id, submittedAt: new Date(), project, demos: [...retained.map((index) => oldDemos[index]), ...uploaded], idempotencyDigest: digest })
      if (!result.ok || result.replayed) await deleteProjectDemos(uploaded).catch(() => console.error("Revision image cleanup failed"))
      if (!result.ok) return failure("This submission has already changed. Reload to continue.", 409)
      return Response.json({ success: true, data: result }, { status: result.replayed ? 200 : 201, headers: { "Cache-Control": "no-store" } })
    } catch (error) {
      // A failed response may follow a committed transaction: preserve assets until reconciled.
      console.error("Revision outcome is uncertain; uploaded images were retained")
      throw error
    }
  } catch (error) {
    if (error instanceof ProjectValidationError || error instanceof ProjectStorageValidationError || error instanceof InvalidIdempotencyKeyError) return failure(error.message, 400)
    console.error("Unable to resubmit project")
    return failure("Unable to resubmit right now. Please try again.", 503)
  }
}
