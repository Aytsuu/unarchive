import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import { ObjectId } from "mongodb"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { canonicalProjectUrl } from "@/lib/projects/citation-url"
import { getProjectMetrics } from "@/lib/projects/metrics"
import type { ProjectSnapshot, ProjectVersion, VersionableProject } from "@/lib/projects/versions"
import { ProjectDetailView } from "@/components/projects/project-detail-view"
import type { ProjectVersionSummary } from "@/components/projects/project-version-history"

function validVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
}

export async function ProjectPageContent({ id, requestedVersion }: { id: string; requestedVersion?: number }) {
  if (!/^[a-f\d]{24}$/i.test(id) || (requestedVersion !== undefined && !validVersion(requestedVersion))) notFound()
  const projectId = new ObjectId(id)
  const [requestHeaders, project] = await Promise.all([
    headers(),
    db.collection<VersionableProject>("projects").findOne({ _id: projectId }, { projection: { title: 1, description: 1, abstract: 1, topics: 1, institution: 1, dateStarted: 1, dateEnded: 1, projectType: 1, referenceProjectIds: 1, contributors: 1, links: 1, demos: 1, createdAt: 1, ownerId: 1, currentVersion: 1, withdrawnAt: 1 }, maxTimeMS: 3000 }),
  ])
  if (!project) notFound()
  if (project.withdrawnAt) return <main className="mx-auto max-w-3xl px-5 py-20"><h1 className="text-2xl font-medium">Project withdrawn</h1><p className="mt-3 text-muted-foreground">This project and its versions are no longer publicly available.</p><Link href="/home" className="mt-6 inline-block text-primary underline">Back to home</Link></main>
  const session = await auth.api.getSession({ headers: requestHeaders })
  const latestVersion = project.currentVersion
  if (latestVersion != null && !validVersion(latestVersion)) throw new Error("Invalid current project version")
  const selected = requestedVersion ?? latestVersion ?? undefined
  const version = selected === undefined ? null : await db.collection<ProjectVersion>("projectVersions").findOne({ projectId, version: selected }, { projection: { version: 1, kind: 1, capturedAt: 1, snapshot: 1 }, maxTimeMS: 3000 })
  if (selected !== undefined && !version) {
    if (requestedVersion !== undefined) notFound()
    throw new Error("Current project snapshot is missing")
  }
  const snapshot: ProjectSnapshot = version?.snapshot ?? { title: project.title, description: project.description, abstract: project.abstract, topics: project.topics, institution: project.institution, dateStarted: project.dateStarted, dateEnded: project.dateEnded, projectType: project.projectType, referenceProjectIds: project.referenceProjectIds, contributors: project.contributors, links: project.links, demos: project.demos ?? [], createdAt: project.createdAt }
  let references = snapshot.references ?? []
  if (!version && snapshot.referenceProjectIds?.length) {
    const ids = snapshot.referenceProjectIds.filter((value) => /^[a-f\d]{24}$/i.test(value))
    const records = await db.collection("projects").find({ _id: { $in: ids.map((value) => new ObjectId(value)) }, withdrawnAt: { $exists: false } }, { projection: { title: 1 }, maxTimeMS: 3000 }).toArray()
    const names = new Map(records.map((record) => [record._id.toHexString(), record.title]))
    references = ids.flatMap((value) => typeof names.get(value.toLowerCase()) === "string" ? [{ id: value, title: names.get(value.toLowerCase()) as string }] : [])
  }
  const [metrics, versions] = await Promise.all([
    session ? getProjectMetrics(db, projectId, session.user.id) : Promise.all([
      db.collection("projectViews").countDocuments({ projectId }, { maxTimeMS: 3000 }),
      db.collection("projectStars").countDocuments({ projectId }, { maxTimeMS: 3000 }),
    ]).then(([views, stars]) => ({ views, stars, starred: false })),
    version ? db.collection<ProjectVersion>("projectVersions").find({ projectId }, { projection: { version: 1, kind: 1, capturedAt: 1 }, maxTimeMS: 3000 }).sort({ version: -1 }).limit(101).toArray() : Promise.resolve([]),
  ])
  const date = snapshot.createdAt instanceof Date && !Number.isNaN(snapshot.createdAt.getTime()) ? { label: new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(snapshot.createdAt), iso: snapshot.createdAt.toISOString() } : null
  const year = snapshot.dateEnded && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(snapshot.dateEnded) ? snapshot.dateEnded.slice(0, 4) : ""
  const summaries: ProjectVersionSummary[] = versions.slice(0, 100).map((item) => ({ version: item.version, kind: item.kind, capturedAt: item.capturedAt.toISOString() }))
  const nextBefore = versions.length > 100 ? summaries.at(-1)?.version ?? null : null
  const versionHistory = version && validVersion(latestVersion) ? { versions: summaries, nextBefore, displayedVersion: version.version, latestVersion, canEdit: session?.user.id === project.ownerId } : undefined
  return <ProjectDetailView user={session?.user ? { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image } : null} project={{
    id, title: snapshot.title, description: snapshot.description, abstract: snapshot.abstract, topics: snapshot.topics, institution: snapshot.institution, dateStarted: snapshot.dateStarted, dateEnded: snapshot.dateEnded, contributors: snapshot.contributors, links: snapshot.links, references, demoCount: snapshot.demos.length, date, metrics,
    ...(version ? { demoBase: `/api/projects/${id}/versions/${version.version}/demos`, versionHistory } : {}),
    citation: { title: snapshot.title, authors: snapshot.contributors ?? [], completionYear: year, institution: snapshot.institution ?? "", projectType: snapshot.projectType === "thesis" ? "Thesis" : "", url: canonicalProjectUrl(process.env.BETTER_AUTH_URL ?? "", id, version?.version), ...(version ? { version: version.version } : {}) },
  }} />
}
