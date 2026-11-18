import { connection } from "next/server"
import { notFound } from "next/navigation"
import { Suspense } from "react"
import { ProjectPageContent } from "@/components/projects/project-page-content"

async function VersionContent({ params }: { params: Promise<{ id: string; version: string }> }) {
  await connection()
  const { id, version } = await params
  if (!/^[1-9]\d*$/.test(version)) notFound()
  return <ProjectPageContent id={id} requestedVersion={Number(version)} />
}
export default function VersionPage({ params }: { params: Promise<{ id: string; version: string }> }) {
  return <Suspense fallback={<main className="min-h-dvh" />}><VersionContent params={params} /></Suspense>
}
