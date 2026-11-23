"use server"

import { revalidatePath } from "next/cache"
import { decideSubmission } from "@unarchive/domain/submissions"
import { requireModerator } from "../../../lib/gate"
import { refreshPublicList } from "../../../lib/refresh-public-list"
import { db } from "@unarchive/server/mongodb"

export type DecisionState =
  | { ok: true; status: "approved" | "changes_requested" }
  | { ok: false; error: "not_found" | "conflict" | "reason_required" | "invalid" }
  | null

export async function decideReview(_state: DecisionState, formData: FormData): Promise<Exclude<DecisionState, null>> {
  const user = await requireModerator()
  const submissionId = formData.get("submissionId")
  const reason = formData.get("revisionReason")
  const decision = formData.get("decision")
  const action = decision === "approve" || decision === "request_revision" ? decision : "invalid"
  if (action === "invalid") return { ok: false, error: "invalid" }
  const result = await decideSubmission(db, {
    id: typeof submissionId === "string" ? submissionId : "",
    moderatorId: user.id,
    action,
    reason: typeof reason === "string" ? reason : "",
  })
  if (result.ok) {
    const id = typeof submissionId === "string" ? submissionId : ""
    revalidatePath(`/reviews/${id}`)
    revalidatePath("/")
    if (result.status === "approved") await refreshPublicList()
  }
  return result
}
