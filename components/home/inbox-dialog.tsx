"use client"

import Link from "next/link"
import { useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type InboxProject = { id: string; title: string }
type InboxProposal = { id: string; projectId: string; projectTitle: string; senderName: string; message: string; createdAt: string; attachmentCount: number }
type InboxPage = { projects: InboxProject[]; proposals: InboxProposal[]; nextCursor: string | null }

function isInboxProject(value: unknown): value is InboxProject {
  if (!value || typeof value !== "object") return false
  const project = value as InboxProject
  return typeof project.id === "string" && typeof project.title === "string"
}

function isInboxProposal(value: unknown): value is InboxProposal {
  if (!value || typeof value !== "object") return false
  const proposal = value as InboxProposal
  return typeof proposal.id === "string" && typeof proposal.projectId === "string" && typeof proposal.projectTitle === "string" && typeof proposal.senderName === "string" && typeof proposal.message === "string"
}

function parseInboxPage(payload: unknown): InboxPage {
  if (!payload || typeof payload !== "object" || !("success" in payload) || !payload.success || !("data" in payload) || !payload.data || typeof payload.data !== "object") throw new Error("Unable to load inbox.")
  const data = payload.data as { projects?: unknown; proposals?: unknown; nextCursor?: unknown }
  if (!Array.isArray(data.projects) || !data.projects.every(isInboxProject) || !Array.isArray(data.proposals) || !data.proposals.every(isInboxProposal) || !(data.nextCursor === null || typeof data.nextCursor === "string")) throw new Error("Unable to load inbox.")
  return { projects: data.projects, proposals: data.proposals, nextCursor: data.nextCursor }
}

async function fetchInbox(cursor: string | null, signal: AbortSignal): Promise<InboxPage> {
  const params = new URLSearchParams()
  if (cursor) params.set("cursor", cursor)
  const response = await fetch(`/api/inbox${params.size ? `?${params}` : ""}`, { signal, cache: "no-store" })
  if (!response.ok) throw new Error("Unable to load inbox.")
  return parseInboxPage(await response.json())
}

export function InboxDialog({ scope }: { scope: string }) {
  const [open, setOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const query = useInfiniteQuery({
    queryKey: ["inbox", scope],
    queryFn: ({ pageParam, signal }) => fetchInbox(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 15_000,
    enabled: open,
  })
  const projects = query.data?.pages[0]?.projects ?? []
  const proposals = query.data?.pages.flatMap((page) => page.proposals) ?? []
  const selectedProject = projects.find((project) => project.id === selectedId) ?? projects[0] ?? null
  const selectedProposals = selectedProject ? proposals.filter((proposal) => proposal.projectId === selectedProject.id) : []

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setSelectedId(null) }}>
      <Tooltip>
        <DialogTrigger render={<TooltipTrigger render={<Button type="button" variant="outline" size="icon" aria-label="Inbox" />} />}>
          <span className="flex size-4 items-center justify-center" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/icons/inbox.svg" alt="" className="h-4 w-auto" />
          </span>
        </DialogTrigger>
        <TooltipContent side="bottom">Proposals</TooltipContent>
      </Tooltip>
      <DialogContent className="flex h-[min(37.6875rem,calc(100vh-4rem))] w-[min(56.6875rem,calc(100vw-2rem))] max-w-[56.6875rem] flex-col gap-0 overflow-hidden rounded-[24px] p-0 shadow-[0_8px_24px_rgba(0,0,0,0.16)] sm:max-w-[56.6875rem]">
        <DialogHeader className="flex h-14 w-full shrink-0 flex-row items-center gap-0 px-4 pr-12">
          <DialogTitle>Inbox</DialogTitle>
          <DialogDescription className="sr-only">Proposals submitted to your projects.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(8.5rem,15.3125rem)_minmax(0,1fr)] border-t">
          <section className="flex min-h-0 flex-col" aria-label="Projects">
            <p className="px-4 pt-4 text-xs text-muted-foreground">Projects</p>
            <div className="min-h-0 flex-1 overflow-y-auto p-1">
              {query.isPending ? <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Loading inbox...</p> : query.isError && !query.data ? <div role="alert" className="px-3 py-2"><p className="text-sm text-destructive">Unable to load your inbox.</p><Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => query.refetch()}>Try again</Button></div> : projects.length === 0 ? <p className="px-3 py-2 text-sm text-muted-foreground">No projects yet.</p> : (
                <ul>{projects.map((project) => {
                  const selected = selectedProject?.id === project.id
                  return <li key={project.id}>
                    <button type="button" aria-current={selected ? "true" : undefined} className={cn("flex w-full cursor-pointer items-center rounded-2xl px-3 py-2 text-left text-sm outline-hidden select-none hover:bg-muted focus-visible:bg-muted", selected && "bg-muted text-foreground")} onClick={() => setSelectedId(project.id)}>
                      <span className="truncate">{project.title}</span>
                    </button>
                  </li>
                })}</ul>
              )}
            </div>
          </section>
          <section className="flex min-h-0 flex-col border-l" aria-label="Proposals">
            <p className="px-4 pt-4 text-xs text-muted-foreground">Proposals</p>
            {query.isPending || (query.isError && !query.data) ? null : !selectedProject || selectedProposals.length === 0 ? (
              <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6">
                <span className="flex size-24 items-center justify-center" aria-hidden="true">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/assets/icons/package-open.svg" alt="" className="size-24" />
                </span>
                <p className="text-center text-sm text-muted-foreground">{selectedProject ? "This project has no proposals yet" : "No projects yet."}</p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-6 text-sm">
                <ul>{selectedProposals.map((proposal) => <li key={proposal.id} className="border-b py-3"><Link href={`/projects/${proposal.projectId}`} onClick={() => setOpen(false)} className="block rounded-md hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
                  <p className="font-medium wrap-break-word">{proposal.senderName}</p>
                  <p className="mt-1 line-clamp-3 wrap-break-word text-muted-foreground">{proposal.message}</p>
                </Link></li>)}</ul>
                {query.hasNextPage && <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading..." : "Load more"}</Button>}
                {query.isFetchNextPageError && <p role="alert" className="mt-2 text-destructive">Could not load more proposals. Please try again.</p>}
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
