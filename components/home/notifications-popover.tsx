"use client"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export function NotificationsPopover() {
  return (
    <Popover>
      <Tooltip>
        <PopoverTrigger render={<TooltipTrigger render={<Button type="button" variant="outline" size="icon" aria-label="Notifications" />} />}>
          <span aria-hidden="true" className="flex size-6 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/icons/notification.svg" alt="" className="h-4 w-auto" />
          </span>
        </PopoverTrigger>
        <TooltipContent side="bottom">Notifications</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="flex h-[min(32.25rem,calc(100vh-8rem))] w-[min(27.6875rem,calc(100vw-2rem))] max-w-[27.6875rem] flex-col gap-2 rounded-[20px] border p-5 shadow-2xl">
        <PopoverHeader className="gap-0 shrink-0">
          <PopoverTitle className="text-sm font-medium">Notifications</PopoverTitle>
          <PopoverDescription className="sr-only">You haven&apos;t received any notifications yet</PopoverDescription>
        </PopoverHeader>
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
          <span className="flex size-[76px] items-center justify-center" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/icons/notification-snooze.svg" alt="" className="size-[76px]" />
          </span>
          <p className="text-center text-sm text-muted-foreground">You haven&apos;t received any notifications yet</p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
