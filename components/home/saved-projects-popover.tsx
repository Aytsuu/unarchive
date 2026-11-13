"use client"

import Link from "next/link"
import { useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"

type SavedPage = { projects: { id: string; title: string }[]; nextCursor: string | null }

async function fetchSavedProjects(cursor: string | null, signal: AbortSignal): Promise<SavedPage> {
  const params = new URLSearchParams()
  if (cursor) params.set("cursor", cursor)
  const response = await fetch(`/api/saved-projects${params.size ? `?${params}` : ""}`, { signal, cache: "no-store" })
  if (!response.ok) throw new Error("Unable to load saved projects.")
  const payload = await response.json()
  if (!payload?.success || !Array.isArray(payload.data?.projects) || !(payload.data.nextCursor === null || typeof payload.data.nextCursor === "string")) throw new Error("Unable to load saved projects.")
  return payload.data as SavedPage
}

export function SavedProjectsPopover({ scope }: { scope: string }) {
  const [open, setOpen] = useState(false)
  const query = useInfiniteQuery({
    queryKey: ["saved-projects", scope],
    queryFn: ({ pageParam, signal }) => fetchSavedProjects(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 15_000,
    enabled: open,
  })
  const projects = query.data?.pages.flatMap((page) => page.projects) ?? []

  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger render={<Button type="button" variant="outline" size="icon" aria-label="Saved projects" />}>
      <span className="flex size-4 items-center justify-center" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/icons/bookmark-save.svg" alt="" className="h-3.5 w-auto" />
      </span>
    </PopoverTrigger>
    <PopoverContent align="end" className="w-80 max-w-[calc(100vw-2rem)] p-4">
      <PopoverTitle>Saved projects</PopoverTitle>
      <div className="mt-3 max-h-80 overflow-y-auto text-sm">
        {query.isPending ? <p role="status" className="text-muted-foreground">Loading saved projects...</p> : query.isError && !query.data ? <div role="alert"><p className="text-destructive">Unable to load saved projects.</p><Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => query.refetch()}>Try again</Button></div> : projects.length === 0 ? <p className="text-muted-foreground">No saved projects yet.</p> : <>
          <ul className="space-y-1">{projects.map((project) => <li key={project.id}><Link href={`/projects/${project.id}`} className="block rounded-md px-2 py-2 wrap-break-word hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">{project.title}</Link></li>)}</ul>
          {query.hasNextPage && <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading..." : "Load more"}</Button>}
          {query.isFetchNextPageError && <p role="alert" className="mt-2 text-destructive">Could not load more saved projects. Please try again.</p>}
        </>}
      </div>
    </PopoverContent>
  </Popover>
}
