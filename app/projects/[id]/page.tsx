import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { connection } from "next/server"
import { Suspense } from "react"
import { ObjectId } from "mongodb"
import { ProjectDetailView } from "@/components/projects/project-detail-view"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { getProjectMetrics } from "@/lib/projects/metrics"

type PublicProject = {
  title: string
  description?: string
  abstract?: string
  topics?: string[]
  institution?: string
  dateStarted?: string
  dateEnded?: string
  referenceProjectIds?: string[]
  contributors?: string[]
  links?: string[]
  demos?: string[]
  createdAt?: Date
}

async function ProjectContent({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  if (!/^[a-f\d]{24}$/i.test(id)) notFound()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  const project = await db.collection<PublicProject>("projects").findOne({ _id: new ObjectId(id) }, { projection: { title: 1, description: 1, abstract: 1, topics: 1, institution: 1, dateStarted: 1, dateEnded: 1, referenceProjectIds: 1, contributors: 1, links: 1, demos: 1, createdAt: 1 } })
  if (!project) notFound()
  const metrics = await getProjectMetrics(db, new ObjectId(id), session.user.id)
  const referenceIds = (project.referenceProjectIds ?? []).filter((referenceId) => /^[a-f\d]{24}$/i.test(referenceId)).slice(0, 20)
  const referencedProjects = referenceIds.length
    ? await db.collection<PublicProject>("projects").find({ _id: { $in: referenceIds.map((referenceId) => new ObjectId(referenceId)) } }, { projection: { title: 1 }, maxTimeMS: 3000 }).toArray()
    : []
  const referencesById = new Map(referencedProjects.map((reference) => [reference._id.toHexString(), reference.title]))
  const references = referenceIds.flatMap((referenceId) => {
    const title = referencesById.get(referenceId.toLowerCase())
    return title ? [{ id: referenceId, title }] : []
  })

  const date = project.createdAt instanceof Date && !Number.isNaN(project.createdAt.getTime())
    ? { label: new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(project.createdAt), iso: project.createdAt.toISOString() }
    : null

  return <ProjectDetailView project={{ id, title: project.title, description: project.description, abstract: project.abstract, topics: project.topics, institution: project.institution, dateStarted: project.dateStarted, dateEnded: project.dateEnded, contributors: project.contributors, links: project.links, references, demoCount: project.demos?.length ?? 0, date, metrics }} user={{ name: session.user.name, email: session.user.email, image: session.user.image }} />
}

export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return <Suspense fallback={<main className="min-h-dvh" />}><ProjectContent params={params} /></Suspense>
}
