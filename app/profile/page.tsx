import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { BrandLogo } from "@/components/brand/brand-logo"
import { auth } from "@/lib/auth"

async function ProfileContent() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <Link href="/home" className="text-xl font-medium"><BrandLogo /></Link>
        <Link href="/home" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
      </header>
      <section className="space-y-4 pt-10">
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <div className="space-y-3 rounded-xl border border-border p-5">
          <div><h2 className="text-sm text-muted-foreground">Name</h2><p>{session.user.name}</p></div>
          <div><h2 className="text-sm text-muted-foreground">Email</h2><p className="break-all">{session.user.email}</p></div>
        </div>
      </section>
    </main>
  )
}

export default function ProfilePage() {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><ProfileContent /></Suspense>
}
