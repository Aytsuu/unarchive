import { connection } from "next/server"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { getSubmission } from "@unarchive/domain/submissions"
import { requireModerator } from "../../../lib/gate"
import { db } from "@unarchive/server/mongodb"
import { ReviewDecision } from "./decision-form"

function formatSubmitted(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

function statusLine(submission: { status: string; submittedAt: string; decidedAt: string }) {
  if (submission.status === "approved" && submission.decidedAt) return `Approved ${formatSubmitted(submission.decidedAt)}`
  if (submission.status === "changes_requested" && submission.decidedAt) return `Revision requested ${formatSubmitted(submission.decidedAt)}`
  return `Submitted ${formatSubmitted(submission.submittedAt)} · Pending`
}

async function Review({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  await requireModerator()
  const submission = await getSubmission(db, id)
  if (!submission) notFound()
  return (
    <main className="mx-auto w-full max-w-3xl px-5 pt-9 pb-16">
      <a href="/" className="text-sm font-medium text-muted-foreground">Back to moderation</a>
      <p className="mt-8 text-sm">{submission.ownerName}</p>
      <p className="mt-1 text-xs text-muted-foreground">{submission.institution || "Institution not listed"}</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">{submission.title}</h1>
      <p className="mt-3 text-xs text-muted-foreground">{statusLine(submission)}</p>
      {submission.status === "changes_requested" ? (
        <section className="mt-6 rounded-[20px] border border-border p-5">
          <h2 className="text-base font-medium">Revisions and reason</h2>
          <p className="mt-2 text-sm leading-6 whitespace-pre-wrap">{submission.revisionReason}</p>
        </section>
      ) : null}
      {submission.description ? <p className="mt-6 text-sm leading-6">{submission.description}</p> : null}
      {submission.abstract ? <section className="mt-8"><h2 className="text-base font-medium">Abstract</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{submission.abstract}</p></section> : null}
      {submission.topics.length > 0 ? <section className="mt-8"><h2 className="text-base font-medium">Topics</h2><ul className="mt-2 flex flex-wrap gap-2">{submission.topics.map((topic: string) => <li key={topic} className="rounded-4xl bg-secondary px-3 py-1 text-sm">{topic}</li>)}</ul></section> : null}
      {submission.contributors.length > 0 ? <section className="mt-8"><h2 className="text-base font-medium">Contributors</h2><ul className="mt-2 text-sm leading-6">{submission.contributors.map((name: string) => <li key={name}>{name}</li>)}</ul></section> : null}
      {submission.links.length > 0 ? <section className="mt-8"><h2 className="text-base font-medium">Links</h2><ul className="mt-2 text-sm">{submission.links.map((link: string) => <li key={link}><a href={link} className="underline underline-offset-4">{link}</a></li>)}</ul></section> : null}
      {submission.status === "pending" ? <ReviewDecision submissionId={submission.id} /> : null}
    </main>
  )
}

export default function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><Review params={params} /></Suspense>
}
