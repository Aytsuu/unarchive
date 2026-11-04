import Link from "next/link"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { buttonVariants } from "@/components/ui/button"
import { SignOutButton } from "@/components/auth-session/sign-out-button"

async function DashboardContent() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Link href="/" className="text-xl font-medium">Unarchive</Link>
        <SignOutButton />
      </header>
      <section className="space-y-3 pt-10">
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Welcome, {session.user.name}.</p>
        <p className="text-sm text-muted-foreground">Signed in as {session.user.email}</p>
        <Link href="/settings" className={buttonVariants({ variant: "outline", className: "mt-4" })}>Account settings</Link>
      </section>
    </main>
  )
}

export default function DashboardPage() {
  return <Suspense fallback={<main className="p-8">Loading dashboard…</main>}><DashboardContent /></Suspense>
}
