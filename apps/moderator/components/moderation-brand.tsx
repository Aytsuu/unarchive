"use client"

import { Badge } from "@/components/ui/badge"

export function ModerationBrand({ home }: { home: string }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <a href={home} className="text-base font-medium sm:text-xl">
        <span className="inline-flex min-w-0 items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/brand/u-a-fusion.svg" alt="" width={24} height={21} className="h-[21px] w-6 shrink-0" />
          <span className="max-[360px]:sr-only">Unarchive</span>
        </span>
      </a>
      <Badge variant="secondary">Moderation</Badge>
    </div>
  )
}
