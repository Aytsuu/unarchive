import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { AccountMenu, type HomeUser } from "@/components/home/account-menu"
import { HomeSearch } from "@/components/home/home-search"
import { SavedProjectsPopover } from "@/components/home/saved-projects-popover"
import { Button, buttonVariants } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

export function HeaderActions({ user, searchControl }: { user: HomeUser | null; searchControl?: ReactNode }) {
  return <div className="flex items-center gap-1 sm:gap-3">
    {user && <Link href="/publish" aria-label="Publish" className={buttonVariants({ className: "gap-2.5 max-sm:size-9 max-sm:p-0" })}><Image src="/assets/icons/publish/archive.svg" alt="" width={16} height={16} className="brightness-0 invert" /><span className="hidden sm:inline">Publish</span></Link>}
    {searchControl ?? (user && <HomeSearch search="" projects={[]} />)}
    {user && <>
      <SavedProjectsPopover scope={user.id} />
      <Popover>
        <PopoverTrigger render={<Button type="button" variant="outline" size="icon" aria-label="Notifications" />}>
          <span aria-hidden="true" className="flex size-6 items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/assets/icons/notification.svg" alt="" className="h-4 w-auto" />
          </span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-64"><p className="text-sm text-muted-foreground">Notifications are coming soon.</p></PopoverContent>
      </Popover>
    </>}
    {user ? <AccountMenu user={user} avatarClassName="size-9" /> : <nav aria-label="Account" className="flex items-center gap-1 sm:gap-4.5"><Link href="/login" className={buttonVariants({ variant: "ghost", className: "max-sm:px-2" })}>Log in</Link><Link href="/signup" className={buttonVariants({ className: "max-sm:px-2" })}>Get Started</Link></nav>}
  </div>
}
