"use client"

import Link from "next/link"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

const notificationFilters = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "action-required", label: "Action Required" },
] as const

type Filter = (typeof notificationFilters)[number]["value"]
type NotificationItem = {
  id: string
  title: string
  body: string
  readAt: string | null
  updatedAt: string
  target: { type: "project" | "submission"; id: string } | null
  group: { count: number } | null
}
type NotificationList = { notifications: NotificationItem[]; unreadCount: number; nextCursor: string | null; cutoff: string }
const emptyMessage = "You haven’t received any notifications yet"

function NotificationsEmptyState() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-[31px]">
      <span className="relative size-[76px] shrink-0" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/icons/notification-snooze.svg" alt="" width="63.3341" height="68.0889" className="absolute top-[5.21%] left-[8.33%] max-w-none" />
      </span>
      <p className="text-center text-sm leading-[18px] font-normal text-[#67787c]">{emptyMessage}</p>
    </div>
  )
}

export function NotificationsPopover() {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<Filter>("all")
  const [data, setData] = useState<NotificationList | null>(null)
  const [status, setStatus] = useState<"idle" | "loading" | "error">("loading")

  const load = useCallback(async (selected: Filter, cursor?: string | null) => {
    if (document.visibilityState === "hidden") return
    const params = new URLSearchParams({ filter: selected })
    if (cursor) params.set("cursor", cursor)
    if (!open) params.set("summary", "1")
    const response = await fetch(`/api/notifications?${params}`, { cache: "no-store" })
    if (!response.ok) throw new Error("Unable to load notifications.")
    const payload = await response.json() as { success?: boolean; data?: NotificationList }
    if (!payload.success || !payload.data) throw new Error("Unable to load notifications.")
    setData((current) => {
      if (!open && current) return { ...current, unreadCount: payload.data!.unreadCount, cutoff: payload.data!.cutoff }
      if (cursor && current) return { ...payload.data!, notifications: [...current.notifications, ...payload.data!.notifications] }
      return payload.data!
    })
  }, [open])

  useEffect(() => {
    let timer = 0
    let active = true
    const refresh = () => {
      if (document.visibilityState === "hidden") return
      void load(filter).then(() => { if (active) setStatus("idle") }).catch(() => { if (active) setStatus("error") })
    }
    const schedule = () => {
      window.clearInterval(timer)
      if (document.visibilityState === "hidden") return
      refresh()
      timer = window.setInterval(refresh, 30_000)
    }
    schedule()
    window.addEventListener("focus", schedule)
    document.addEventListener("visibilitychange", schedule)
    return () => {
      active = false
      window.clearInterval(timer)
      window.removeEventListener("focus", schedule)
      document.removeEventListener("visibilitychange", schedule)
    }
  }, [filter, load])

  async function markRead(body: { id: string } | { all: true; cutoff: string }) {
    const response = await fetch("/api/notifications", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    if (!response.ok) { setStatus("error"); return }
    await load(filter)
  }

  const items = data?.notifications ?? []
  const unread = data?.unreadCount ?? 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <PopoverTrigger render={<TooltipTrigger render={<Button type="button" variant="outline" size="icon" aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"} />} />}>
          <span aria-hidden="true" className="relative flex size-6 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/icons/notification.svg" alt="" className="h-4 w-auto" />
            {unread > 0 ? <span className="absolute -top-1 -right-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] leading-4 text-primary-foreground">{unread > 9 ? "9+" : unread}</span> : null}
          </span>
        </PopoverTrigger>
        <TooltipContent side="bottom">Notifications</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="flex h-[min(32.25rem,calc(100vh-8rem))] w-[min(27.6875rem,calc(100vw-2rem))] max-w-[27.6875rem] flex-col gap-0 overflow-hidden rounded-[20px] border px-5 pt-5 pb-0 shadow-2xl">
        <PopoverHeader className="shrink-0 gap-0">
          <div className="flex items-center justify-between gap-3">
            <PopoverTitle className="text-sm leading-[18px] font-medium">Notifications</PopoverTitle>
            {unread > 0 && data?.cutoff ? <Button type="button" variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => void markRead({ all: true, cutoff: data.cutoff })}>Mark all read</Button> : null}
          </div>
          <PopoverDescription className="sr-only">{emptyMessage}</PopoverDescription>
        </PopoverHeader>
        <Tabs value={filter} onValueChange={(value) => { setData(null); setStatus("loading"); setFilter(value as Filter) }} className="mt-6 min-h-0 flex-1 gap-0">
          <TabsList className="grid h-6 w-full grid-cols-3 gap-0 rounded-none bg-transparent p-0 group-data-horizontal/tabs:h-6">
            {notificationFilters.map((item) => (
              <TabsTrigger key={item.value} value={item.value} className="h-6 rounded-full border-0 bg-transparent px-0 py-0 text-sm leading-[18px] font-normal text-[#67787c] shadow-none after:hidden hover:text-[#67787c] data-active:bg-[#eee] data-active:text-[#6f677c] data-active:shadow-none data-active:hover:bg-[#eee] data-active:hover:text-[#6f677c]">
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <div className="relative min-h-0 flex-1">
            {notificationFilters.map((item) => (
              <TabsContent key={item.value} value={item.value} className="flex h-full min-h-0 flex-col outline-none">
                {status === "loading" && !data ? <p className="py-6 text-center text-sm text-muted-foreground">Loading notifications...</p> : status === "error" ? <div role="alert" className="py-6 text-center"><p className="text-sm text-destructive">Unable to load notifications.</p><Button type="button" variant="secondary" size="sm" className="mt-2" onClick={() => void load(filter).then(() => setStatus("idle")).catch(() => setStatus("error"))}>Try again</Button></div> : items.length === 0 ? <NotificationsEmptyState /> : (
                  <div className="min-h-0 flex-1 overflow-y-auto pt-4">
                    <ul className="flex flex-col gap-3">
                      {items.map((item) => <li key={item.id} className="rounded-[20px] border p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-medium text-foreground">{item.title}</p>
                            <p className="mt-1 text-sm text-[#67787c]">{item.body}</p>
                          </div>
                          {item.readAt ? null : <Button type="button" variant="ghost" size="sm" className="h-6 shrink-0 px-2 text-xs" onClick={() => void markRead({ id: item.id })}>Mark read</Button>}
                        </div>
                        {item.target ? <Link href={item.target.type === "submission" ? `/submissions/${item.target.id}` : `/projects/${item.target.id}`} className="mt-2 inline-block text-sm text-foreground underline-offset-4 hover:underline" onClick={() => setOpen(false)}>{item.target.type === "submission" ? "Review requested changes" : "View project"}</Link> : null}
                      </li>)}
                    </ul>
                    {data?.nextCursor ? <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => void load(filter, data.nextCursor)}>Load more</Button> : null}
                  </div>
                )}
              </TabsContent>
            ))}
          </div>
        </Tabs>
        <p className="shrink-0 py-3 text-center text-xs text-[#67787c]">Notifications are kept for 90 days.</p>
      </PopoverContent>
    </Popover>
  )
}
