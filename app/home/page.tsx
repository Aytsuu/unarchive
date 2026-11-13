import { headers } from "next/headers"
import { connection } from "next/server"
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { parseListingParams } from "@/lib/projects/listing-params.mjs"
import { HomeScreen } from "@/components/home/home-screen"
import { ProjectListingQuery, ProjectSearchQuery, ProjectTopicsQuery } from "@/components/home/project-query"
import { StatisticsSkeleton, TopicsSkeleton } from "@/components/home/home-skeletons"
import { ProjectListSkeleton } from "@/components/home/project-list-skeleton"

async function HomeContent({ searchParams }: { searchParams: Promise<{ q?: string | string[]; page?: string | string[]; size?: string | string[] }> }) {
  await connection()
  const [requestHeaders, query] = await Promise.all([headers(), searchParams])
  const session = await auth.api.getSession({ headers: requestHeaders })
  const user = session?.user ? { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image } : null
  const params = new URLSearchParams()
  for (const name of ["q", "page", "size"] as const) if (typeof query[name] === "string") params.set(name, query[name])
  const { search, page, pageSize } = parseListingParams(params)
  const args = { search, page, pageSize, scope: session?.user?.id ?? "guest" }
  return <HomeScreen user={user} pageSize={pageSize} searchControl={<ProjectSearchQuery {...args} />} topicsContent={<ProjectTopicsQuery {...args} />}>
    <ProjectListingQuery {...args} />
  </HomeScreen>
}

export default function HomePage({ searchParams }: PageProps<"/home">) {
  return <Suspense fallback={<main className="min-h-dvh bg-background"><div className="mx-auto w-full max-w-341.5 px-5 pt-24"><div className="mb-10"><StatisticsSkeleton /></div><TopicsSkeleton /><ProjectListSkeleton /></div></main>}><HomeContent searchParams={searchParams} /></Suspense>
}
