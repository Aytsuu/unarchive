import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { BrandLogo } from "@/components/brand/brand-logo"
import { buttonVariants } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { auth } from "@/lib/auth"

async function GetToKnowContent() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  return (
    <main className="min-h-dvh bg-background px-5 pb-16 pt-16 text-foreground sm:pt-51">
      <div className="mx-auto flex w-full flex-col items-center">
        <Link href="/" className="text-xl font-medium leading-10 focus-visible:outline-2 focus-visible:outline-ring"><BrandLogo /></Link>
        <Progress value={100} aria-label="Signup progress" className="mt-9 w-55 **:data-[slot=progress-track]:h-2" />
        <h1 className="mt-6 text-sm font-medium">Getting to know you</h1>
        <div className="mt-10.5 grid w-full max-w-194.25 grid-cols-1 gap-3.75 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-34 rounded-[20px] border border-border bg-card" />
          ))}
        </div>
        <Link href="/home" replace className={buttonVariants({ className: "mt-8 w-full max-w-[254px]" })}>Skip</Link>
      </div>
    </main>
  )
}

export default function GetToKnowPage() {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><GetToKnowContent /></Suspense>
}
