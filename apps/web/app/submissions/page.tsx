import Link from "next/link"
import { headers } from "next/headers"
import { connection } from "next/server"
import { redirect } from "next/navigation"
import { ObjectId } from "mongodb"
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"

async function SubmissionsContent({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  const { before } = await searchParams
  const cursor = before && /^[a-f\d]{24}$/i.test(before) ? new ObjectId(before) : null
  const records = await db.collection("projectSubmissions").find({ ownerId: session.user.id, ...(cursor ? { _id: { $lt: cursor } } : {}) }, { projection: { snapshot: 1, status: 1, projectId: 1, resubmittedAt: 1, submittedAt: 1 }, maxTimeMS: 3000 }).sort({ _id: -1 }).limit(51).toArray()
  const page = records.slice(0, 50)
  return <main className="mx-auto max-w-3xl px-6 py-12">
    <Link href="/profile" className="text-sm underline">Back to profile</Link>
    <h1 className="mt-6 text-3xl font-semibold">My submissions</h1>
    {page.length === 0 ? <p className="mt-6 text-muted-foreground">No submissions found.</p> : <ul className="mt-6 space-y-3">{page.map((record) => {
      const id = record._id.toHexString()
      const status = record.status === "changes_requested" ? (record.resubmittedAt ? "Revision resubmitted" : "Revision requested") : record.status === "approved" ? "Approved" : "Pending review"
      return <li key={id} className="rounded-xl border p-4"><h2 className="font-medium">{typeof record.snapshot?.title === "string" ? record.snapshot.title : "Project submission"}</h2><p className="mt-1 text-sm text-muted-foreground">{status}</p>
        {record.status === "changes_requested" ? <Link className="mt-2 inline-block text-sm underline" href={`/submissions/${id}`}>View feedback</Link> : record.status === "approved" ? <Link className="mt-2 inline-block text-sm underline" href={`/projects/${String(record.projectId ?? record._id)}`}>View project</Link> : null}
      </li>
    })}</ul>}
    {records.length > 50 && <Link href={`/submissions?before=${page[page.length - 1]._id.toHexString()}`} className="mt-6 inline-block text-sm underline">Older submissions</Link>}
  </main>
}

export default function SubmissionsPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  return <Suspense fallback={<main className="p-8">Loading submissions...</main>}><SubmissionsContent searchParams={searchParams} /></Suspense>
}
