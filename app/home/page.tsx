import { headers } from "next/headers"
import { connection } from "next/server"
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { HomeScreen, type HomeProject } from "@/components/home/home-screen"
import type { ObjectId } from "mongodb"

type ProjectRecord = { _id: ObjectId; title: string; description?: string; institution?: string; ownerId: string; topics?: string[]; contributors?: string[]; createdAt: Date }

async function HomeContent({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; size?: string | string[] }> }) {
  await connection()
  const requestHeaders = await headers()
  const query = await searchParams
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 100) : ""
  const filter = search ? { title: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } } : {}
  const collection = db.collection<ProjectRecord>("projects")
  const session = await auth.api.getSession({ headers: requestHeaders })
  const allowedSizes = [3, 6, 9, 12]
  const requestedSize = typeof query.size === "string" ? Number(query.size) : 3
  const pageSize = session && allowedSizes.includes(requestedSize) ? requestedSize : 3
  const requestedPage = typeof query.page === "string" && /^\d+$/.test(query.page) ? Number(query.page) : 1
  const total = await collection.countDocuments(filter, { maxTimeMS: 3000 })
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const page = session && Number.isSafeInteger(requestedPage) ? Math.min(Math.max(1, requestedPage), pages) : 1
  const records = await collection.find(filter, { projection: { title: 1, description: 1, institution: 1, ownerId: 1, topics: 1, contributors: 1 }, maxTimeMS: 3000 }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray()
  const ids = records.map((project) => project._id)
  const ownerIds = [...new Set(records.map((project) => project.ownerId).filter(Boolean))]
  const [views, stars, owners] = await Promise.all([
    db.collection("projectViews").aggregate<{ _id: ObjectId; count: number }>([{ $match: { projectId: { $in: ids } } }, { $group: { _id: "$projectId", count: { $sum: 1 } } }], { maxTimeMS: 3000 }).toArray(),
    db.collection("projectStars").aggregate<{ _id: ObjectId; count: number }>([{ $match: { projectId: { $in: ids } } }, { $group: { _id: "$projectId", count: { $sum: 1 } } }], { maxTimeMS: 3000 }).toArray(),
    db.collection("user").aggregate<{ _id: ObjectId | string; name?: string }>([{ $match: { $expr: { $in: [{ $toString: "$_id" }, ownerIds] } } }, { $project: { name: 1 } }], { maxTimeMS: 3000 }).toArray(),
  ])
  const viewsByProject = new Map(views.map((item) => [item._id.toString(), item.count]))
  const starsByProject = new Map(stars.map((item) => [item._id.toString(), item.count]))
  const namesById = new Map(owners.map((owner) => [owner._id.toString(), owner.name]))
  const projects: HomeProject[] = records.map((project) => ({
    id: project._id.toString(),
    title: project.title,
    description: project.description ?? "",
    institution: project.institution ?? "",
    publisher: namesById.get(project.ownerId) || "Publisher",
    topics: project.topics ?? [],
    views: viewsByProject.get(project._id.toString()) ?? 0,
    stars: starsByProject.get(project._id.toString()) ?? 0,
    collaborators: 1 + (project.contributors ?? []).filter((name) => name.trim().toLocaleLowerCase() !== namesById.get(project.ownerId)?.trim().toLocaleLowerCase()).length,
  }))
  return <HomeScreen user={session?.user ? { name: session.user.name, email: session.user.email, image: session.user.image } : null} projects={projects} total={total} search={search} page={page} pageSize={pageSize} />
}

export default function HomePage({ searchParams }: PageProps<"/home">) {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><HomeContent searchParams={searchParams} /></Suspense>
}
