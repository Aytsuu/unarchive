"use client"

import { useActionState, useState } from "react"
import { decideReview, type DecisionState } from "./actions"

const buttonClass = "inline-flex h-9 items-center justify-center rounded-4xl px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"

function decisionError(state: DecisionState) {
  if (!state || state.ok) return null
  if (state.error === "conflict") return "This submission was already decided."
  if (state.error === "reason_required") return "Describe what must change and why."
  if (state.error === "not_found") return "This submission is no longer available."
  return "Choose approve or request revision."
}

export function ReviewDecision({ submissionId }: { submissionId: string }) {
  const [revisionSelected, setRevisionSelected] = useState(false)
  const [reason, setReason] = useState("")
  const [state, action, pending] = useActionState(decideReview, null)
  const error = decisionError(state)
  const reasonMissing = reason.trim().length === 0

  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="text-base font-medium">Decision</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        <form action={action}>
          <input type="hidden" name="submissionId" value={submissionId} />
          <button type="submit" name="decision" value="approve" disabled={pending} className={`${buttonClass} bg-primary text-primary-foreground`}>Approve</button>
        </form>
        <button
          type="button"
          aria-pressed={revisionSelected}
          onClick={() => setRevisionSelected(true)}
          className={`${buttonClass} border border-border ${revisionSelected ? "bg-secondary" : "bg-background"}`}
        >
          Request revision
        </button>
      </div>
      {revisionSelected ? (
        <form action={action} className="mt-6">
          <input type="hidden" name="submissionId" value={submissionId} />
          <input type="hidden" name="decision" value="request_revision" />
          <label className="block text-sm font-medium" htmlFor="revision-reason">
            Revisions and reason
            <span className="mt-1 block font-normal text-muted-foreground">State what must change and why.</span>
          </label>
          <textarea
            id="revision-reason"
            name="revisionReason"
            required
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 min-h-32 w-full rounded-[20px] border border-border bg-background px-3 py-2 text-sm leading-6 font-normal outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button type="submit" disabled={reasonMissing || pending} className={`${buttonClass} mt-4 border border-border`}>Request revision</button>
        </form>
      ) : null}
      {error ? <p role="alert" className="mt-4 text-sm text-destructive">{error}</p> : null}
    </section>
  )
}
