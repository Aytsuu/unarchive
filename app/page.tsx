import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"

export default function Home() {
  return (
    <main className="min-h-dvh bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 px-5 pt-[21px] sm:pl-10 sm:pr-[31px]">
        <span className="flex h-10 items-center text-xl font-medium">Unarchive</span>
        <Link href="/signup" className={buttonVariants()}>Get Started</Link>
      </header>
    </main>
  )
}
