import { headers } from "next/headers"
import { connection } from "next/server"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { moderationHrefFor } from "@/lib/moderation/href"
import { TopicScreen } from "@/components/topics/topic-screen"
import { TopicListingQuery } from "@/components/topics/topic-query"
import { ProjectSearchQuery } from "@/components/home/project-query"
import { ProjectListSkeleton } from "@/components/home/project-list-skeleton"
import { topicFromSlug } from "@/lib/projects/topic-slug.mjs"

async function TopicContent({ params }: { params: Promise<{ topic: string }> }) {
  await connection()
  const { topic: slug } = await params
  const topic = topicFromSlug(slug)
  if (!topic) notFound()
  const requestHeaders = await headers()
  const session = await auth.api.getSession({ headers: requestHeaders })
  const user = session?.user ? { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image } : null
  const scope = session?.user?.id ?? "guest"
  const moderationHref = await moderationHrefFor(session?.user?.id)
  return (
    <TopicScreen topic={topic} user={user} moderationHref={moderationHref} searchControl={<Suspense fallback={null}><ProjectSearchQuery scope={scope} /></Suspense>}>
      <Suspense fallback={<ProjectListSkeleton />}><TopicListingQuery topic={topic} scope={scope} /></Suspense>
    </TopicScreen>
  )
}

export default function TopicPage({ params }: PageProps<"/topics/[topic]">) {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><TopicContent params={params} /></Suspense>
}
