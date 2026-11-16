"use client"

import { useSyncExternalStore } from "react"
import { listingShowsInitialSkeleton } from "@/lib/projects/home-query-args.mjs"
import { parseListingParams } from "@/lib/projects/listing-params.mjs"
import { listingQueryForViewport } from "@/lib/projects/listing-viewport.mjs"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { TopicListing } from "@/components/topics/topic-listing"
import { ProjectListSkeleton } from "@/components/home/project-list-skeleton"
import type { HomeProject } from "@/components/home/home-screen"

type Listing = { projects: HomeProject[]; total: number; page: number; pageSize: number }

function subscribeToViewport(callback: () => void) {
  window.addEventListener("resize", callback)
  return () => window.removeEventListener("resize", callback)
}

export function TopicListingQuery({ topic, scope }: { topic: string; scope: string }) {
  const searchParams = useSearchParams()
  const parsed = parseListingParams(searchParams)
  const width = useSyncExternalStore(subscribeToViewport, () => window.innerWidth, () => null)
  const selection = listingQueryForViewport(width, parsed.page, parsed.pageSize)
  const query = useQuery({
    queryKey: ["topic-list", scope, topic, parsed.search, parsed.sort, parsed.yearFrom, parsed.yearTo, parsed.institutions, selection?.page, selection?.pageSize],
    enabled: selection !== null,
    staleTime: 15_000,
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<Listing> => {
      const params = new URLSearchParams({ topic, page: String(selection!.page), size: String(selection!.pageSize) })
      if (parsed.search) params.set("q", parsed.search)
      if (parsed.sort) params.set("sort", parsed.sort)
      if (parsed.yearFrom) params.set("from", String(parsed.yearFrom))
      if (parsed.yearTo) params.set("to", String(parsed.yearTo))
      for (const institution of parsed.institutions) params.append("institution", institution)
      const response = await fetch(`/api/projects?${params}`, { signal, cache: "no-store" })
      if (!response.ok) throw new Error("Unable to load projects.")
      return (await response.json()).data
    },
  })
  const filters = {
    sort: parsed.sort,
    yearFrom: parsed.yearFrom ? String(parsed.yearFrom) : "",
    yearTo: parsed.yearTo ? String(parsed.yearTo) : "",
    institutions: parsed.institutions,
    search: parsed.search,
  }
  if (listingShowsInitialSkeleton(selection !== null, query)) return <ProjectListSkeleton />
  if (!query.data) return <section role="alert"><p className="mt-4 text-sm text-muted-foreground">Unable to load projects. Please try again.</p><Button className="mt-3" variant="outline" onClick={() => query.refetch()}>Retry</Button></section>
  return <TopicListing topic={topic} projects={query.data.projects} total={query.data.total} page={query.data.page} pageSize={query.data.pageSize} filters={filters} scope={scope} isFetching={query.isFetching} />
}
