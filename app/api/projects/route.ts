import { auth } from "@/lib/auth"
import { ObjectId } from "mongodb"
import { db } from "@/lib/mongodb"
import { ProjectStorageConfigurationError, ProjectStorageValidationError, deleteProjectDemos, saveProjectDemos } from "@/lib/project-storage"
import { claimProjectAttempt } from "@/lib/projects/rate-limit"
import { parseProject, ProjectValidationError } from "@/lib/projects/validation"
import { getSubmissionIdentity, InvalidIdempotencyKeyError } from "@/lib/projects/idempotency"

const MAX_REQUEST_BYTES = 26 * 1024 * 1024
const MAX_FILE_BYTES = 5 * 1024 * 1024
const MAX_FILES = 5
const MAX_METADATA_CHARS = 64 * 1024

class RequestError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

function failure(error: string, status: number, headers?: Record<string, string>) {
  return Response.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store", ...headers } })
}

function success(id: ObjectId) {
  return Response.json({ success: true, data: { id: id.toString() } }, { status: 201, headers: { "Cache-Control": "no-store" } })
}

async function cleanUpDemos(demos: string[]) {
  try { await deleteProjectDemos(demos) } catch { console.error("Project demo cleanup failed") }
}

async function readMultipart(request: Request): Promise<FormData> {
  const contentType = request.headers.get("content-type") ?? ""
  if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new RequestError("Send project details as multipart form data.", 415)
  const length = request.headers.get("content-length")
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) throw new RequestError("The upload is too large.", 413)
  if (!request.body) throw new RequestError("Project details are required.", 400)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_REQUEST_BYTES) {
        await reader.cancel()
        throw new RequestError("The upload is too large.", 413)
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  try {
    return await new Response(bytes, { headers: { "Content-Type": contentType } }).formData()
  } catch { throw new RequestError("Invalid multipart form data.", 400) }
}

function readSubmission(form: FormData) {
  const metadata = form.getAll("project")
  if (metadata.length !== 1 || typeof metadata[0] !== "string" || metadata[0].length > MAX_METADATA_CHARS) throw new RequestError("Invalid project details.", 400)
  let raw: unknown
  try { raw = JSON.parse(metadata[0]) } catch { throw new RequestError("Invalid project details.", 400) }
  const project = parseProject(raw)
  const files = form.getAll("demos")
  if (files.length > MAX_FILES || files.some((file) => !(file instanceof File) || file.size === 0 || file.size > MAX_FILE_BYTES)) {
    throw new RequestError("Upload up to five images, each no larger than 5 MiB.", 400)
  }
  return { project, files: files as File[] }
}

export async function POST(request: Request) {
  let expectedOrigin: string
  try { expectedOrigin = new URL(process.env.BETTER_AUTH_URL ?? request.url).origin } catch { return failure("Publishing is temporarily unavailable.", 503) }
  if (request.headers.get("origin") !== expectedOrigin) return failure("Invalid request origin.", 403)

  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return failure("Please sign in to publish.", 401)
    const retryAfter = await claimProjectAttempt(db, session.user.id)
    if (retryAfter) return failure("Too many publishing attempts. Please try again later.", 429, { "Retry-After": String(retryAfter) })
    const { project, files } = readSubmission(await readMultipart(request))
    const key = request.headers.get("idempotency-key")
    const identity = key === null ? null : await getSubmissionIdentity(session.user.id, key, project, files)
    const projectId = identity?.id ?? new ObjectId()
    const projects = db.collection("projects")
    if (identity) {
      const existing = await projects.findOne({ _id: projectId }, { projection: { ownerId: 1, idempotencyDigest: 1 } })
      if (existing) {
        if (existing.ownerId === session.user.id && existing.idempotencyDigest === identity.digest) return success(projectId)
        return failure("This submission key was already used for a different project.", 409)
      }
    }
    const demos = await saveProjectDemos(files)
    const now = new Date()
    try {
      await projects.insertOne({ _id: projectId, ...project, demos, ownerId: session.user.id, createdAt: now, updatedAt: now, ...(identity ? { idempotencyDigest: identity.digest } : {}) })
    } catch (error) {
      let inserted
      try { inserted = await projects.findOne({ _id: projectId }, { projection: { ownerId: 1, idempotencyDigest: 1, demos: 1 } }) } catch {
        console.error("Could not determine project insertion outcome; uploaded demos were retained")
        throw error
      }
      if (inserted) {
        const sameAssets = Array.isArray(inserted.demos) && inserted.demos.length === demos.length && inserted.demos.every((key: unknown, index: number) => key === demos[index])
        if (!sameAssets) await cleanUpDemos(demos)
        if (inserted.ownerId === session.user.id && (identity ? inserted.idempotencyDigest === identity.digest : sameAssets)) return success(projectId)
        return failure("This submission key was already used for a different project.", 409)
      }
      const definitiveFailure = typeof error === "object" && error !== null && "code" in error && (error.code === 11000 || error.code === 121)
      if (definitiveFailure) await cleanUpDemos(demos)
      else console.error("Project insertion outcome is uncertain; uploaded demos were retained")
      throw error
    }
    return success(projectId)
  } catch (error) {
    if (error instanceof RequestError) return failure(error.message, error.status)
    if (error instanceof ProjectValidationError || error instanceof ProjectStorageValidationError || error instanceof InvalidIdempotencyKeyError) return failure(error.message, 400)
    if (error instanceof ProjectStorageConfigurationError) return failure(error.message, 503)
    console.error("Project publishing failed")
    return failure("Unable to publish your project right now. Please try again.", 500)
  }
}
