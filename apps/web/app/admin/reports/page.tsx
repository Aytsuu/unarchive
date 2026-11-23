import { headers } from "next/headers"
import { connection } from "next/server"
import { notFound, redirect } from "next/navigation"
import { Suspense } from "react"
import { AdminReports } from "@/components/legal/admin-reports"
import { isLegalAdmin } from "@/lib/legal/admin"
import { auth } from "@/lib/auth"

async function AdminReportsContent() {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  if (!isLegalAdmin(session.user.email)) notFound()
  return <AdminReports />
}

export default function AdminReportsPage() {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><AdminReportsContent /></Suspense>
}
