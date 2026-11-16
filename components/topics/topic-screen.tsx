import Link from "next/link"
import type { ReactNode } from "react"
import type { HomeUser } from "@/components/home/account-menu"
import { HeaderActions } from "@/components/home/header-actions"
import { ResponsivePageSize } from "@/components/home/responsive-page-size"
import { buttonVariants } from "@/components/ui/button"

export function TopicScreen({ topic, user, searchControl, children }: { topic: string; user: HomeUser | null; searchControl: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <main className="flex-1 pb-16">
        <ResponsivePageSize />
        <header className="flex w-full items-center justify-between gap-4 px-5 pt-9.25 sm:pl-7.5 sm:pr-8.5">
          <div className="flex min-w-0 items-center gap-5.25 max-sm:gap-1">
            <Link href="/home" aria-label="Back to home" className={buttonVariants({ variant: "secondary", size: "icon" })}>
              <span aria-hidden="true" className="relative block size-5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/publish/undo-curve.svg" alt="" className="absolute left-[1.75px] top-[5.9px]" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/publish/undo-arrow.svg" alt="" className="absolute left-[1.75px] top-[2.9px]" />
              </span>
            </Link>
            <h1 className="truncate text-xl font-medium">{topic}</h1>
          </div>
          <HeaderActions user={user} searchControl={searchControl} />
        </header>
        <div className="mx-auto mt-12.75 w-full max-w-341.5 px-5">
          {children}
        </div>
      </main>
    </div>
  )
}
