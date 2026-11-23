"use client"

import Link from "next/link"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { BrandLogo } from "@/components/brand/brand-logo"
import { isLandingHeaderCompactFromSentinel } from "@/lib/landing/header-scroll"
import { cn } from "@/lib/utils"

const morph = "duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none"

export function LandingHeader({ account }: { account: ReactNode }) {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [compact, setCompact] = useState(false)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(([entry]) => {
      setCompact(isLandingHeaderCompactFromSentinel(entry.isIntersecting))
    }, { threshold: 0 })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="pointer-events-none h-px w-full" />
      <div className="pointer-events-none sticky top-0 z-50 w-full">
        <header
          data-compact={compact ? "true" : "false"}
          className={cn(
            "group/header pointer-events-auto mx-auto box-border flex items-center justify-between overflow-hidden border isolate",
            "transition-[max-width,width,height,margin,padding,border-radius,border-color,box-shadow,background-color,backdrop-filter,-webkit-backdrop-filter]",
            morph,
            compact
              ? "mt-3 h-15 w-[calc(100%-1.5rem)] max-w-125 rounded-[100px] border-white/50 bg-background/90 pt-0 pr-4 pl-5.75 shadow-[inset_0_1px_0_rgba(255,255,255,0.55),0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur-xl backdrop-saturate-150 supports-backdrop-filter:bg-background/65 [@media(prefers-reduced-transparency:reduce)]:bg-background [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none"
              : "mt-0 h-18 w-full max-w-full rounded-none border-transparent bg-transparent px-5 pt-9 shadow-none backdrop-blur-none sm:px-10 lg:pr-8.5 lg:pl-11.5",
          )}
        >
          <Link href="/" className="text-xl font-medium" aria-label={compact ? "Unarchive" : undefined}>
            <BrandLogo
              markWidth={29}
              markHeight={26}
              wordmarkHidden={compact}
              className={cn("transition-[gap]", morph, "group-data-[compact=true]/header:gap-0")}
              markClassName={cn("h-[21px] w-6 transition-[width,height]", morph, "group-data-[compact=true]/header:h-[26px] group-data-[compact=true]/header:w-[29px]")}
              wordmarkClassName={cn(
                "inline-block max-w-40 overflow-hidden whitespace-nowrap transition-[max-width,opacity]",
                morph,
                "group-data-[compact=true]/header:max-w-0 group-data-[compact=true]/header:opacity-0",
              )}
            />
          </Link>
          {account}
        </header>
      </div>
    </>
  )
}
