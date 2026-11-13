import Link from "next/link"
import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"
import { ObjectId } from "mongodb"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { buttonVariants } from "@/components/ui/button"
import { ProjectEditForm } from "@/components/projects/project-edit-form"

type EditProject = {
  _id: ObjectId; ownerId: string; title: string; description?: string; abstract?: string;
  institution?: string; dateStarted?: string; dateEnded?: string; projectType?: string;
  topics?: string[]; links?: string[]; contributors?: string[]; referenceProjectIds?: string[];
  currentVersion?: number | null; withdrawnAt?: Date
}

async function EditContent({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  if (!/^[a-f\d]{24}$/i.test(id)) notFound()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  const projectId = new ObjectId(id)
  const project = await db.collection<EditProject>("projects").findOne({ _id: projectId, ownerId: session.user.id, withdrawnAt: { $exists: false } }, { projection: { ownerId: 1, title: 1, description: 1, abstract: 1, institution: 1, dateStarted: 1, dateEnded: 1, projectType: 1, topics: 1, links: 1, contributors: 1, referenceProjectIds: 1, currentVersion: 1 }, maxTimeMS: 3000 })
  if (!project) notFound()
  const currentVersion = project.currentVersion
  if (typeof currentVersion !== "number" || !Number.isSafeInteger(currentVersion) || currentVersion < 1) return <main className="mx-auto min-h-dvh max-w-180 px-5 py-12"><h1 className="text-2xl font-medium">Edit project</h1><p className="mt-4 text-sm text-muted-foreground">This project needs a version history before it can be edited.</p><Link href={`/projects/${id}`} className={buttonVariants({ variant: "secondary", className: "mt-4" })}>Back to project</Link></main>
  const existingVersion = await db.collection("projectVersions").findOne({ projectId, version: currentVersion }, { projection: { _id: 1 }, maxTimeMS: 3000 })
  if (!existingVersion) throw new Error("Project version history is inconsistent")
  const referenceIds = project.referenceProjectIds ?? []
  const validIds = referenceIds.filter((value) => /^[a-f\d]{24}$/i.test(value))
  const found = validIds.length ? await db.collection<{ title: string }>("projects").find({ _id: { $in: validIds.map((value) => new ObjectId(value)) }, withdrawnAt: { $exists: false } }, { projection: { title: 1 }, maxTimeMS: 3000 }).toArray() : []
  const titles = new Map(found.map((item) => [item._id.toHexString(), item.title]))
  const references = referenceIds.map((referenceId) => ({ id: referenceId, title: titles.get(referenceId.toLowerCase()) ?? `Unavailable project (${referenceId})` }))
  const unavailableReferenceIds = references.filter((reference) => !titles.has(reference.id.toLowerCase()) || reference.id.toLowerCase() === id.toLowerCase()).map((reference) => reference.id)
  return <ProjectEditForm initial={{ id: projectId.toHexString(), currentVersion, title: project.title, description: project.description ?? "", abstract: project.abstract ?? "", institution: project.institution ?? "", dateStarted: project.dateStarted ?? "", dateEnded: project.dateEnded ?? "", projectType: project.projectType ?? "", topics: project.topics ?? [], links: project.links ?? [], contributors: project.contributors ?? [], references, unavailableReferenceIds }} />
}

export default function EditPage({ params }: PageProps<"/projects/[id]/edit">) {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><EditContent params={params} /></Suspense>
}
