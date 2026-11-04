import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Suspense } from "react"
import { PublishForm } from "@/components/publish/publish-form"
import { auth } from "@/lib/auth"

async function PublishContent() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) redirect("/login")

  return <PublishForm />
}

export default function PublishPage() {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><PublishContent /></Suspense>
}
