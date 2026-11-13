import { connection } from "next/server"
import { Suspense } from "react"
import { ProjectPageContent } from "@/components/projects/project-page-content"

async function ProjectContent({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  const { id } = await params
  return <ProjectPageContent id={id} />
}
export default function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  return <Suspense fallback={<main className="min-h-dvh" />}><ProjectContent params={params} /></Suspense>
}
