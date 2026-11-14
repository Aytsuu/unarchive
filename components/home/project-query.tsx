"use client"

import { useSyncExternalStore } from "react"
import { listingShowsInitialSkeleton, projectListingArgs } from "@/lib/projects/home-query-args.mjs"
import { parseListingParams } from "@/lib/projects/listing-params.mjs"
import { listingQueryForViewport } from "@/lib/projects/listing-viewport.mjs"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { HomeTopics, ProjectListing, type HomeProject } from "@/components/home/home-screen"
import { HomeSearch } from "@/components/home/home-search"
import { ProjectListSkeleton } from "@/components/home/project-list-skeleton"

type ListingScope = { scope: string }
type TopicsArgs = { scope?: string }
type Listing = { projects: HomeProject[]; total: number; page: number; pageSize: number }

function subscribeToViewport(callback: () => void) {
  window.addEventListener("resize", callback)
  return () => window.removeEventListener("resize", callback)
}
function viewportWidth() { return window.innerWidth }
function serverViewport() { return null }

function useProjectListing({ scope }: ListingScope) {
  const searchParams = useSearchParams()
  const { search, page, pageSize } = projectListingArgs({ ...parseListingParams(searchParams), scope })
  const width = useSyncExternalStore(subscribeToViewport, viewportWidth, serverViewport)
  const selection = listingQueryForViewport(width, page, pageSize)
  const query = useQuery({
    queryKey: ["project-list", scope, search, selection?.page, selection?.pageSize],
    enabled: selection !== null,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<Listing> => {
      const params = new URLSearchParams({ q: search, page: String(selection!.page), size: String(selection!.pageSize) })
      const response = await fetch(`/api/projects?${params}`, { signal, cache: "no-store" })
      if (!response.ok) throw new Error("Unable to load projects.")
      const payload = await response.json()
      return payload.data
    },
  })
  return { query, ready: selection !== null, search }
}

export function ProjectSearchQuery(props: ListingScope) {
  const { query, ready, search } = useProjectListing(props)
  return <HomeSearch search={search} projects={ready ? query.data?.projects ?? [] : []} />
}

export function ProjectTopicsQuery({}: TopicsArgs) {
  return <HomeTopics />
}

export function ProjectListingQuery(props: ListingScope) {
  const { query, ready, search } = useProjectListing(props)
  if (listingShowsInitialSkeleton(ready, query)) return <ProjectListSkeleton />
  if (!query.data) return <section className="mt-14" role="alert"><p className="mt-4 text-sm text-muted-foreground">Unable to load projects. Please try again.</p><Button className="mt-3" variant="outline" onClick={() => query.refetch()}>Retry</Button></section>
  return <ProjectListing projects={query.data.projects} total={query.data.total} search={search} page={query.data.page} pageSize={query.data.pageSize} scope={props.scope} isFetching={query.isFetching} />
}
