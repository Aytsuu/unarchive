import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"
import { ObjectId } from "mongodb"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { SubmitProposalForm } from "@/components/projects/submit-proposal-form"

async function SubmitProposalContent({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  if (!/^[a-f\d]{24}$/i.test(id)) notFound()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  const project = await db.collection<{ ownerId: string; title: string; withdrawnAt?: Date }>("projects").findOne({ _id: new ObjectId(id) }, { projection: { ownerId: 1, title: 1, withdrawnAt: 1 }, maxTimeMS: 3000 })
  if (!project || project.withdrawnAt) notFound()
  if (project.ownerId === session.user.id) redirect(`/projects/${id}`)
  return <SubmitProposalForm projectId={id} title={project.title} />
}

export default function SubmitProposalPage({ params }: PageProps<"/projects/[id]/submit-proposal">) {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><SubmitProposalContent params={params} /></Suspense>
}
