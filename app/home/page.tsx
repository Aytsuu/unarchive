import { headers } from "next/headers"
import { connection } from "next/server"
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { db } from "@/lib/mongodb"
import { HomeScreen, type HomeProject } from "@/components/home/home-screen"
import type { ObjectId } from "mongodb"

type ProjectRecord = { _id: ObjectId; title: string; description?: string; institution?: string; createdAt: Date }

async function HomeContent({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  await connection()
  const requestHeaders = await headers()
  const query = await searchParams
  const search = typeof query.q === "string" ? query.q.trim().slice(0, 100) : ""
  const filter = search ? { title: { $regex: search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" } } : {}
  const collection = db.collection<ProjectRecord>("projects")
  const session = await auth.api.getSession({ headers: requestHeaders })
  const [total, records] = await Promise.all([
    collection.countDocuments(filter, { maxTimeMS: 3000 }),
    collection.find(filter, { projection: { title: 1, description: 1, institution: 1 }, maxTimeMS: 3000 }).sort({ createdAt: -1, _id: -1 }).limit(session ? 24 : 4).toArray(),
  ])
  const projects: HomeProject[] = records.map((project) => ({
    id: project._id.toString(),
    title: project.title,
    description: project.description ?? "",
    institution: project.institution ?? "",
  }))
  return <HomeScreen user={session?.user ? { name: session.user.name, email: session.user.email, image: session.user.image } : null} projects={projects} total={total} search={search} />
}

export default function HomePage({ searchParams }: PageProps<"/home">) {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><HomeContent searchParams={searchParams} /></Suspense>
}
