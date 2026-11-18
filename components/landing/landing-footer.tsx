import Link from "next/link"
import { BrandLogo } from "@/components/brand/brand-logo"
import { copyrightYear } from "@/lib/landing/copyright-year"
import { landingFooterGroups } from "@/lib/landing/links"

export async function LandingFooter() {
  return (
    <footer className="px-5 pt-16 pb-20 sm:px-10 lg:px-20">
      <div className="mx-auto flex w-full max-w-276.5 flex-col gap-9.5">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-[minmax(0,330px)_repeat(3,minmax(0,1fr))] lg:gap-6">
          <div className="max-w-80">
            <Link href="/" className="text-xl font-medium"><BrandLogo /></Link>
            <p className="mt-3 text-sm text-muted-foreground">A place for academic work to be discovered and shared.</p>
          </div>
          {landingFooterGroups().map((group) => (
            <nav key={group.title} aria-label={group.title} className="flex flex-col gap-3">
              <p className="text-sm font-semibold">{group.title}</p>
              {group.links.map((link) => (
                <Link key={`${group.title}-${link.label}`} href={link.href} className="text-[13px] text-muted-foreground hover:text-foreground">{link.label}</Link>
              ))}
            </nav>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">© Unarchive {await copyrightYear()}. All rights reserved.</p>
      </div>
    </footer>
  )
}
