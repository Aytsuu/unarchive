"use client"

import { useSyncExternalStore } from "react"
import { listingQueryForViewport } from "@/lib/projects/listing-viewport.mjs"
import { useQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { HomeTopics, ProjectListing, type HomeProject } from "@/components/home/home-screen"
import { HomeSearch } from "@/components/home/home-search"
import { TopicsSkeleton } from "@/components/home/home-skeletons"
import { ProjectListSkeleton } from "@/components/home/project-list-skeleton"
import type { HomeUser } from "@/components/home/account-menu"

type ListingArgs = { search: string; page: number; pageSize: number; user: HomeUser | null; scope: string }
type Listing = { projects: HomeProject[]; total: number; page: number; pageSize: number }

function subscribeToViewport(callback: () => void) {
  window.addEventListener("resize", callback)
  return () => window.removeEventListener("resize", callback)
}
function viewportWidth() { return window.innerWidth }
function serverViewport() { return null }

function useProjectListing({ search, page, pageSize, scope, user }: ListingArgs) {
  const width = useSyncExternalStore(subscribeToViewport, viewportWidth, serverViewport)
  const selection = listingQueryForViewport(width, !!user, page, pageSize)
  const query = useQuery({
    queryKey: ["project-list", scope, search, selection?.page, selection?.pageSize],
    enabled: selection !== null,
    staleTime: 15_000,
    queryFn: async ({ signal }): Promise<Listing> => {
      const params = new URLSearchParams({ q: search, page: String(selection!.page), size: String(selection!.pageSize) })
      const response = await fetch(`/api/projects?${params}`, { signal, cache: "no-store" })
      if (!response.ok) throw new Error("Unable to load projects.")
      const payload = await response.json()
      return payload.data
    },
  })
  return { query, ready: selection !== null }
}

export function ProjectSearchQuery(props: ListingArgs) {
  const { query, ready } = useProjectListing(props)
  return <HomeSearch search={props.search} projects={ready ? query.data?.projects ?? [] : []} />
}

export function ProjectTopicsQuery(props: ListingArgs) {
  const { query, ready } = useProjectListing(props)
  return !ready || query.isPending ? <TopicsSkeleton /> : <HomeTopics />
}

export function ProjectListingQuery(props: ListingArgs) {
  const { query, ready } = useProjectListing(props)
  if (!ready || query.isPending) return <ProjectListSkeleton />
  if (!query.data) return <section className="mt-14" role="alert"><p className="mt-4 text-sm text-muted-foreground">Unable to load projects. Please try again.</p><Button className="mt-3" variant="outline" onClick={() => query.refetch()}>Retry</Button></section>
  return <ProjectListing user={props.user} projects={query.data.projects} total={query.data.total} search={props.search} page={query.data.page} pageSize={query.data.pageSize} />
}
