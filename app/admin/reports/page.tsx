import { headers } from "next/headers"
import { notFound, redirect } from "next/navigation"
import { AdminReports } from "@/components/legal/admin-reports"
import { isLegalAdmin } from "@/lib/legal/admin"
import { auth } from "@/lib/auth"

export default async function AdminReportsPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")
  if (!isLegalAdmin(session.user.email)) notFound()
  return <AdminReports />
}
