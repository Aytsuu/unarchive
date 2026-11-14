import { headers } from "next/headers"
import { connection } from "next/server"
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { projectTopicsArgs } from "@/lib/projects/home-query-args.mjs"
import { HomeScreen } from "@/components/home/home-screen"
import { ProjectListingQuery, ProjectSearchQuery, ProjectTopicsQuery } from "@/components/home/project-query"
import { StatisticsSkeleton, TopicsSkeleton } from "@/components/home/home-skeletons"
import { ProjectListSkeleton } from "@/components/home/project-list-skeleton"

async function HomeContent() {
  await connection()
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })
  const user = session?.user ? { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image } : null
  const scope = session?.user?.id ?? "guest"
  return <HomeScreen user={user} searchControl={<Suspense fallback={null}><ProjectSearchQuery scope={scope} /></Suspense>} topicsContent={<ProjectTopicsQuery {...projectTopicsArgs({ scope })} />}>
    <Suspense fallback={<ProjectListSkeleton />}><ProjectListingQuery scope={scope} /></Suspense>
  </HomeScreen>
}

export default function HomePage() {
  return <Suspense fallback={<main className="min-h-dvh bg-background"><div className="mx-auto w-full max-w-341.5 px-5 pt-24"><div className="mb-10"><StatisticsSkeleton /></div><TopicsSkeleton /><ProjectListSkeleton /></div></main>}><HomeContent /></Suspense>
}
