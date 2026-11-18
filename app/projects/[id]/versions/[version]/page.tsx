import { connection } from "next/server"
import { notFound, permanentRedirect } from "next/navigation"
import { Suspense } from "react"

async function LegacyVersionContent({ params }: { params: Promise<{ id: string; version: string }> }) {
  await connection()
  const { id, version } = await params
  if (!/^[a-f\d]{24}$/i.test(id) || !/^[1-9]\d*$/.test(version)) notFound()
  permanentRedirect(`/projects/${id}/v/${version}`)
}

export default function LegacyVersionPage({ params }: { params: Promise<{ id: string; version: string }> }) {
  return <Suspense fallback={<main className="min-h-dvh" />}><LegacyVersionContent params={params} /></Suspense>
}
