import type { Db } from "mongodb"
import { createMcpHandler } from "mcp-handler"
import { z } from "zod"
import { decideSubmission, getSubmission, listPendingReviewDetails, PENDING_SUBMISSION_LIMIT } from "@unarchive/domain/submissions"

export { PENDING_SUBMISSION_LIMIT }

export const MODERATION_BOT_ID = "unarchive-moderation-bot"

const submissionId = z.string().regex(/^[a-f0-9]{24}$/i, { error: "Submission id must be a 24-character hexadecimal string." })
const revisionReason = z.string().trim().min(1, { error: "A revision reason is required." }).max(4000, { error: "A revision reason must be at most 4000 characters." })

const reviewDetails = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  institution: z.string(),
  ownerName: z.string(),
  submittedAt: z.string(),
  status: z.string(),
  revisionReason: z.string(),
  decidedAt: z.string(),
  abstract: z.string(),
  topics: z.array(z.string()),
  contributors: z.array(z.string()),
  links: z.array(z.string()),
  dateStarted: z.string(),
  dateEnded: z.string(),
})

type ToolContent = { type: "text"; text: string }
type ToolResult = { content: ToolContent[]; structuredContent?: Record<string, unknown>; isError?: boolean }

type DecisionClient = {
  startSession(): {
    withTransaction<T>(work: () => Promise<T>): Promise<T>
    endSession(): Promise<void>
  }
}

export type PublishModerationDependencies = {
  db: Db
  client: DecisionClient
  invalidateProjectList: () => void | Promise<void>
}

type ModerationHandler = (request: Request) => Promise<Response> | Response

export function createDevelopmentOnlyHandlers(handler: ModerationHandler, env: { NODE_ENV?: string } = process.env) {
  const respond = (request: Request) => {
    if (env.NODE_ENV !== "development") return new Response(null, { status: 404 })
    return handler(request)
  }
  return { GET: respond, POST: respond, DELETE: respond }
}

export function createPublishModerationHandler(deps: PublishModerationDependencies) {
  return createMcpHandler((server) => {
    registerPublishModerationTools(server, deps)
  }, {
    serverInfo: { name: "unarchive-publish-moderation", version: "1.0.0" },
    instructions: `Development-only publication moderation. Decisions are recorded as ${MODERATION_BOT_ID}. list_pending_submissions returns at most the oldest ${PENDING_SUBMISSION_LIMIT} pending submissions. get_pending_submission returns one pending submission by id, including a submission outside that queue.`,
  })
}

type ModerationServer = Parameters<Parameters<typeof createMcpHandler>[0]>[0]

export function registerPublishModerationTools(server: ModerationServer, deps: PublishModerationDependencies) {
  server.registerTool("list_pending_submissions", {
    title: "List pending submissions",
    description: `Returns review details for up to the oldest ${PENDING_SUBMISSION_LIMIT} submissions waiting for publication, including abstracts, topics, contributors, links, and dates.`,
    inputSchema: z.object({}),
    outputSchema: z.object({ submissions: z.array(reviewDetails) }),
    annotations: { readOnlyHint: true },
  }, () => listPending(deps))
  server.registerTool("get_pending_submission", {
    title: "Get pending submission",
    description: "Returns review details for one submission by id. A pending submission is returned even when it is outside the oldest 100 in the queue.",
    inputSchema: z.object({ id: submissionId }),
    outputSchema: reviewDetails,
    annotations: { readOnlyHint: true },
  }, ({ id }) => getPending(deps, id))
  server.registerTool("approve_submission", {
    title: "Approve submission",
    description: `Publishes a pending submission through the moderation decision service. The decision is recorded as ${MODERATION_BOT_ID}.`,
    inputSchema: z.object({ id: submissionId }),
    outputSchema: z.object({ id: z.string(), status: z.literal("approved") }),
  }, ({ id }) => approveSubmission(deps, id))
  server.registerTool("request_submission_revision", {
    title: "Request submission revision",
    description: `Requests changes for a pending submission. The reason must be nonblank and at most 4000 characters. The decision is recorded as ${MODERATION_BOT_ID}.`,
    inputSchema: z.object({ id: submissionId, reason: revisionReason }),
    outputSchema: z.object({ id: z.string(), status: z.literal("changes_requested") }),
  }, ({ id, reason }) => requestRevision(deps, id, reason))
}

function jsonResult(value: Record<string, unknown>): ToolResult {
  return { content: [{ type: "text", text: JSON.stringify(value) }], structuredContent: value }
}

function toolError(text: string): ToolResult {
  return { content: [{ type: "text", text }], isError: true }
}

async function getPending(deps: PublishModerationDependencies, id: string): Promise<ToolResult> {
  try {
    const submission = await getSubmission(deps.db, id)
    if (!submission) return toolError("No submission exists with that id.")
    if (submission.status !== "pending") return toolError("This submission has already been decided.")
    return jsonResult(submission)
  } catch (error) {
    console.error("Pending submission lookup failed", error)
    return toolError("The submission could not be loaded.")
  }
}

async function listPending(deps: PublishModerationDependencies): Promise<ToolResult> {
  try {
    const submissions = await listPendingReviewDetails(deps.db)
    return jsonResult({ submissions })
  } catch (error) {
    console.error("Pending submission list failed", error)
    return toolError("Pending submissions could not be loaded.")
  }
}

function decisionError(error: string) {
  if (error === "not_found") return "No submission exists with that id."
  if (error === "conflict") return "This submission has already been decided."
  if (error === "reason_required") return "A revision reason is required."
  return "The decision is not valid."
}

async function finishDecision(deps: PublishModerationDependencies, id: string, action: "approve" | "request_revision", reason?: string): Promise<ToolResult> {
  try {
    const result = await decideSubmission(deps.db, { id, moderatorId: MODERATION_BOT_ID, action, reason }, deps.client)
    if (!result.ok) return toolError(decisionError(result.error))
    if (result.status === "approved") await invalidateProjectList(deps)
    const canonicalId = id.toLowerCase()
    const text = result.status === "approved" ? `Approved submission ${canonicalId}.` : `Requested a revision for submission ${canonicalId}.`
    return { content: [{ type: "text", text }], structuredContent: { id: canonicalId, status: result.status } }
  } catch (error) {
    console.error("Moderation decision failed", error)
    return toolError("The submission could not be decided.")
  }
}

async function invalidateProjectList(deps: PublishModerationDependencies) {
  try {
    await deps.invalidateProjectList()
  } catch (error) {
    console.error("Project listing cache invalidation failed", error)
  }
}

function approveSubmission(deps: PublishModerationDependencies, id: string) {
  return finishDecision(deps, id, "approve")
}

function requestRevision(deps: PublishModerationDependencies, id: string, reason: string) {
  return finishDecision(deps, id, "request_revision", reason)
}
