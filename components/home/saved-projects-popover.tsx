"use client"

import Link from "next/link"
import { useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { TopicIcon, topicStyles } from "@/components/projects/topic-icon"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "cn"

type SavedProject = { id: string; title: string; description: string; topics: string[]; publisher: string; savedAt: string; savedLabel: string }
type SavedPage = { projects: SavedProject[]; nextCursor: string | null }

function isSavedProject(value: unknown): value is SavedProject {
  if (!value || typeof value !== "object") return false
  const project = value as SavedProject
  return typeof project.id === "string" && typeof project.title === "string" && typeof project.description === "string" && Array.isArray(project.topics) && typeof project.publisher === "string" && typeof project.savedAt === "string" && typeof project.savedLabel === "string"
}

function parseSavedPage(payload: unknown): SavedPage {
  if (!payload || typeof payload !== "object" || !("success" in payload) || !payload.success || !("data" in payload) || !payload.data || typeof payload.data !== "object") throw new Error("Unable to load saved projects.")
  const data = payload.data as { projects?: unknown; nextCursor?: unknown }
  if (!Array.isArray(data.projects) || !data.projects.every(isSavedProject) || !(data.nextCursor === null || typeof data.nextCursor === "string")) throw new Error("Unable to load saved projects.")
  return { projects: data.projects, nextCursor: data.nextCursor }
}

async function fetchSavedProjects(cursor: string | null, signal: AbortSignal): Promise<SavedPage> {
  const params = new URLSearchParams()
  if (cursor) params.set("cursor", cursor)
  const response = await fetch(`/api/saved-projects${params.size ? `?${params}` : ""}`, { signal, cache: "no-store" })
  if (!response.ok) throw new Error("Unable to load saved projects.")
  return parseSavedPage(await response.json())
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
    <Tooltip>
      <PopoverTrigger render={<TooltipTrigger render={<Button type="button" variant="outline" size="icon" aria-label="Saved projects" />} />}>
        <span className="flex size-4 items-center justify-center" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/icons/bookmark-save.svg" alt="" className="h-3.5 w-auto" />
        </span>
      </PopoverTrigger>
      <TooltipContent side="bottom">Saved</TooltipContent>
    </Tooltip>
    <PopoverContent align="end" className="flex h-[min(32.25rem,calc(100vh-8rem))] w-[min(27.6875rem,calc(100vw-2rem))] max-w-[27.6875rem] flex-col gap-2 rounded-[20px] border p-5 shadow-2xl">
      <PopoverHeader className="gap-2 shrink-0">
        <PopoverTitle className="text-sm font-medium">Saved Projects</PopoverTitle>
        {projects.length > 0 ? <PopoverDescription className="text-sm">Projects you&apos;ve bookmarked to read or revisit later.</PopoverDescription> : null}
      </PopoverHeader>
      <div className="min-h-0 flex-1 overflow-y-auto pt-1">
        {query.isPending ? <p role="status" className="py-2 text-sm text-muted-foreground">Loading saved projects...</p> : query.isError && !query.data ? <div role="alert"><p className="text-sm text-destructive">Unable to load saved projects.</p><Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => query.refetch()}>Try again</Button></div> : projects.length === 0 ? (
          <div className="flex min-h-[min(24rem,calc(100%-1rem))] flex-col items-center justify-center gap-3 pb-6">
            <span className="flex size-24 items-center justify-center" aria-hidden="true">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/icons/package-open.svg" alt="" className="size-24" />
            </span>
            <p className="text-center text-sm text-muted-foreground">No saved projects yet</p>
          </div>
        ) : <>
          <ul className="flex flex-col gap-3">{projects.map((project) => <li key={project.id}>
            <Link href={`/projects/${project.id}`} onClick={() => setOpen(false)} className="flex min-h-[9.625rem] cursor-pointer flex-col rounded-[20px] border bg-card p-5 outline-hidden transition-colors hover:bg-muted/30 focus-visible:bg-muted/30">
              <p className="truncate text-base leading-[18px] font-normal text-foreground">{project.title}</p>
              {project.description && <p className="mt-1.5 line-clamp-2 text-sm leading-[18px] text-muted-foreground">{project.description}</p>}
              <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                {project.topics.length > 0 ? <ul className="flex gap-2">{project.topics.slice(0, 2).map((topic) => <li key={topic} title={topic} aria-label={topic} className={cn("flex size-7 shrink-0 items-center justify-center rounded-full", topicStyles[topic]?.color ?? "bg-secondary")}><span className="flex items-center justify-center opacity-60"><TopicIcon topic={topic} size={14} /></span></li>)}</ul> : <span />}
                <span className="shrink-0 text-xs text-muted-foreground">{project.savedLabel}</span>
              </div>
            </Link>
          </li>)}</ul>
          {query.hasNextPage && <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading..." : "Load more"}</Button>}
          {query.isFetchNextPageError && <p role="alert" className="mt-2 text-destructive">Could not load more saved projects. Please try again.</p>}
        </>}
      </div>
    </PopoverContent>
  </Popover>
}