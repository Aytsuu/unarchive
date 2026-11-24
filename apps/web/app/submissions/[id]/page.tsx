import { headers } from "next/headers"
import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { ObjectId } from "mongodb"
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { ownerSubmission } from "@/lib/projects/revision-submission"
import { RevisionForm, type RevisionInitial } from "@/components/publish/revision-form"

async function SubmissionContent({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  const { id } = await params
  const submission = await ownerSubmission(db, id, session.user.id)
  if (!submission?.snapshot || submission.status !== "changes_requested") notFound()
  const snapshot = submission.snapshot
  const ids: string[] = Array.isArray(snapshot.referenceProjectIds) ? snapshot.referenceProjectIds.filter((v: unknown): v is string => typeof v === "string" && /^[a-f\d]{24}$/i.test(v)) : []
  const matches = ids.length ? await db.collection("projects").find({ _id: { $in: ids.map((value) => new ObjectId(value)) }, withdrawnAt: { $exists: false } }, { projection: { title: 1 } }).toArray() : []
  const titles = new Map(matches.map((p) => [p._id.toHexString(), String(p.title)]))
  const initial: RevisionInitial = {
    id, title: snapshot.title ?? "", description: snapshot.description ?? "", abstract: snapshot.abstract ?? "",
    institution: snapshot.institution ?? "", dateStarted: snapshot.dateStarted ?? "", dateEnded: snapshot.dateEnded ?? "",
    topics: snapshot.topics ?? [], links: snapshot.links ?? [], contributors: snapshot.contributors ?? [],
    references: ids.map((ref) => ({ id: ref, title: titles.get(ref.toLowerCase()) ?? "Unavailable project" })),
    unavailableIds: ids.filter((ref) => !titles.has(ref.toLowerCase())),
    demoCount: Array.isArray(snapshot.demos) ? snapshot.demos.length : 0,
    reason: typeof submission.revisionReason === "string" ? submission.revisionReason : "",
    resubmitted: Boolean(submission.resubmittedAt),
  }
  return <RevisionForm initial={initial} />
}

export default function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<main className="p-8">Loading submission...</main>}><SubmissionContent params={params} /></Suspense>
}
