import { ObjectId } from "mongodb"
import { connection } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { metricsError, metricsSuccess } from "@/lib/projects/metrics-api"
import { claimMetricsAttempt } from "@/lib/projects/metrics-rate-limit"
import { parseProposalFiles, parseProposalMessage, ProposalValidationError } from "@/lib/projects/proposal-validation"
import { createProposal, getProposalTarget } from "@/lib/projects/proposals"
import { ProjectStorageConfigurationError, ProjectStorageValidationError, deleteProposalAttachments, saveProposalAttachments } from "@/lib/project-storage"

type Context = { params: Promise<{ id: string }> }

const MAX_REQUEST_BYTES = 26 * 1024 * 1024

class RequestError extends Error {
  constructor(message: string, readonly status: number) { super(message) }
}

async function readMultipart(request: Request) {
  const contentType = request.headers.get("content-type") ?? ""
  if (!/^multipart\/form-data\s*;/i.test(contentType)) throw new RequestError("Send your proposal as multipart form data.", 415)
  const length = request.headers.get("content-length")
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST_BYTES)) throw new RequestError("The upload is too large.", 413)
  if (!request.body) throw new RequestError("A proposal message is required.", 400)
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

export async function POST(request: Request, context: Context) {
  await connection()
  let expectedOrigin: string
  try { expectedOrigin = new URL(process.env.BETTER_AUTH_URL ?? request.url).origin } catch { return metricsError("Submitting a proposal is temporarily unavailable.", 503) }
  if (request.headers.get("origin") !== expectedOrigin) return metricsError("Invalid request origin.", 403)

  let attachments: string[] = []
  try {
    const session = await auth.api.getSession({ headers: request.headers })
    if (!session) return metricsError("Please sign in to submit a proposal.", 401)
    const { id } = await context.params
    if (!/^[a-f\d]{24}$/i.test(id)) return metricsError("Project not found.", 404)
    const retryAfter = await claimMetricsAttempt(db, session.user.id, "proposal")
    if (retryAfter) return metricsError("Too many requests. Please try again later.", 429, { "Retry-After": String(retryAfter) })
    const projectId = new ObjectId(id)
    const target = await getProposalTarget(db, projectId, session.user.id)
    if ("error" in target) return metricsError(target.error === "own_project" ? "You cannot submit a proposal to your own project." : "Project not found.", target.error === "own_project" ? 403 : 404)
    const form = await readMultipart(request)
    const message = parseProposalMessage(form.get("message"))
    const files = parseProposalFiles(form.getAll("attachments"))
    attachments = await saveProposalAttachments(files)
    const created = await createProposal(db, { projectId, senderId: session.user.id, message, attachments })
    return Response.json({ success: true, data: { id: created.id } }, { status: 201, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (attachments.length) try { await deleteProposalAttachments(attachments) } catch { console.error("Proposal attachment cleanup failed") }
    if (error instanceof RequestError) return metricsError(error.message, error.status)
    if (error instanceof ProposalValidationError || error instanceof ProjectStorageValidationError) return metricsError(error.message, 400)
    if (error instanceof ProjectStorageConfigurationError) return metricsError(error.message, 503)
    console.error("Project proposal could not be submitted", error)
    return metricsError("Unable to submit your proposal. Please try again.", 500)
  }
}
