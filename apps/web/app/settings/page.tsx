import Link from "next/link"
import { headers } from "next/headers"
import { connection } from "next/server"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { BrandLogo } from "@/components/brand/brand-logo"
import { auth } from "@/lib/auth"
import { NotificationSettings } from "@/components/settings/notification-settings"

async function SettingsContent() {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <header className="flex items-center justify-between gap-4">
        <Link href="/" className="text-xl font-medium"><BrandLogo /></Link>
        <Link href="/home" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
      </header>
      <section className="space-y-4 pt-10">
        <h1 className="text-3xl font-semibold tracking-tight">Account settings</h1>
        <p className="text-sm text-muted-foreground">Signed in as {session.user.email}</p>
        <NotificationSettings />
      </section>
    </main>
  )
}

export default function SettingsPage() {
  return <Suspense fallback={<main className="p-8">Loading settings…</main>}><SettingsContent /></Suspense>
}
