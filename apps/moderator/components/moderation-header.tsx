import { HeaderActions } from "@/components/home/header-actions"
import { BrandLogo } from "@/components/brand/brand-logo"
import { Badge } from "@/components/ui/badge"

export function ModerationHeader({ user, home }: { user: { id: string; name: string; email: string; image?: string | null }; home: string }) {
  return (
    <header className="flex items-center justify-between gap-2 px-3 pt-9.25 sm:gap-4 sm:pl-11.5 sm:pr-8.5">
      <div className="flex min-w-0 items-center gap-3">
        <a href={`${home.replace(/\/$/, "")}/home`} className="text-base font-medium sm:text-xl"><BrandLogo compactOnSmallScreens /></a>
        <Badge variant="secondary">Moderation</Badge>
      </div>
      <HeaderActions user={user} variant="account" linkBase={home} signedOutHref={home} />
    </header>
  )
}
