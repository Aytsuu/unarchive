import Link from "next/link"
import { BrandLogo } from "@/components/brand/brand-logo"
import { buttonVariants } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="flex items-start justify-between gap-4 px-5 pt-5.25 sm:pl-10 sm:pr-8.75">
        <span className="flex h-10 items-center text-xl font-medium"><BrandLogo /></span>
        <nav aria-label="Account" className="mt-2.5 flex items-center gap-4.5">
          <Link href="/login" className={buttonVariants({ variant: "ghost" })}>Log in</Link>
          <Link href="/signup" className={buttonVariants()}>Get Started</Link>
        </nav>
      </header>
    </main>
  )
}
