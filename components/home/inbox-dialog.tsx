"use client"

import Link from "next/link"
import { useState } from "react"
import { useInfiniteQuery } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

type InboxPage = { proposals: { id: string; projectId: string; projectTitle: string; senderName: string; message: string; createdAt: string; attachmentCount: number }[]; nextCursor: string | null }

async function fetchInbox(cursor: string | null, signal: AbortSignal): Promise<InboxPage> {
  const params = new URLSearchParams()
  if (cursor) params.set("cursor", cursor)
  const response = await fetch(`/api/inbox${params.size ? `?${params}` : ""}`, { signal, cache: "no-store" })
  if (!response.ok) throw new Error("Unable to load inbox.")
  const payload = await response.json()
  if (!payload?.success || !Array.isArray(payload.data?.proposals) || !(payload.data.nextCursor === null || typeof payload.data.nextCursor === "string")) throw new Error("Unable to load inbox.")
  return payload.data as InboxPage
}

export function InboxDialog({ scope }: { scope: string }) {
  const [open, setOpen] = useState(false)
  const query = useInfiniteQuery({
    queryKey: ["inbox", scope],
    queryFn: ({ pageParam, signal }) => fetchInbox(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    staleTime: 15_000,
    enabled: open,
  })
  const proposals = query.data?.pages.flatMap((page) => page.proposals) ?? []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Tooltip>
        <DialogTrigger render={<TooltipTrigger render={<Button type="button" variant="outline" size="icon" aria-label="Inbox" />} />}>
          <span className="flex size-4 items-center justify-center" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/icons/inbox.svg" alt="" className="h-4 w-auto" />
          </span>
        </DialogTrigger>
        <TooltipContent side="bottom">Proposals</TooltipContent>
      </Tooltip>
      <DialogContent className="w-80 max-w-[calc(100vw-2rem)] gap-3 p-4 sm:max-w-80">
        <DialogHeader>
          <DialogTitle>Inbox</DialogTitle>
          <DialogDescription className="sr-only">Proposals submitted to your projects.</DialogDescription>
        </DialogHeader>
        <div className="max-h-80 overflow-y-auto text-sm">
          {query.isPending ? <p role="status" className="text-muted-foreground">Loading inbox...</p> : query.isError && !query.data ? <div role="alert"><p className="text-destructive">Unable to load your inbox.</p><Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => query.refetch()}>Try again</Button></div> : proposals.length === 0 ? <p className="text-muted-foreground">No proposals yet.</p> : <>
            <ul className="space-y-1">{proposals.map((proposal) => <li key={proposal.id}><Link href={`/projects/${proposal.projectId}`} onClick={() => setOpen(false)} className="block rounded-md px-2 py-2 hover:bg-accent focus-visible:outline-2 focus-visible:outline-ring">
              <p className="font-medium wrap-break-word">{proposal.projectTitle}</p>
              <p className="mt-0.5 text-muted-foreground wrap-break-word">{proposal.senderName}</p>
              <p className="mt-1 line-clamp-2 wrap-break-word">{proposal.message}</p>
            </Link></li>)}</ul>
            {query.hasNextPage && <Button type="button" variant="secondary" size="sm" className="mt-3" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{query.isFetchingNextPage ? "Loading..." : "Load more"}</Button>}
            {query.isFetchNextPageError && <p role="alert" className="mt-2 text-destructive">Could not load more proposals. Please try again.</p>}
          </>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
