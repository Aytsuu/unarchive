import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { AccountMenu, type HomeUser } from "@/components/home/account-menu"
import { HomeSearch } from "@/components/home/home-search"
import { InboxDialog } from "@/components/home/inbox-dialog"
import { NotificationsPopover } from "@/components/home/notifications-popover"
import { SavedProjectsPopover } from "@/components/home/saved-projects-popover"
import { buttonVariants } from "@/components/ui/button"

export function HeaderActions({ user, searchControl, moderationHref }: { user: HomeUser | null; searchControl?: ReactNode; moderationHref?: string }) {
  return <div className="flex items-center gap-1 sm:gap-3">
    {moderationHref ? <a href={moderationHref} className={buttonVariants({ variant: "outline", className: "max-sm:px-2" })}>Moderation</a> : null}
    {user && <Link href="/publish" aria-label="Publish" className={buttonVariants({ className: "gap-2.5 max-sm:size-9 max-sm:p-0" })}><Image src="/assets/icons/publish/archive.svg" alt="" width={16} height={16} className="brightness-0 invert" /><span className="hidden sm:inline">Publish</span></Link>}
    {searchControl ?? (user && <HomeSearch search="" projects={[]} />)}
    {user && <>
      <InboxDialog scope={user.id} />
      <SavedProjectsPopover scope={user.id} />
      <NotificationsPopover />
    </>}
    {user ? <AccountMenu user={user} avatarClassName="size-9" /> : <nav aria-label="Account" className="flex items-center gap-1 sm:gap-4.5"><Link href="/login" className={buttonVariants({ variant: "ghost", className: "max-sm:px-2" })}>Log in</Link><Link href="/signup" className={buttonVariants({ className: "max-sm:px-2" })}>Get Started</Link></nav>}
  </div>
}
