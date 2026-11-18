import Link from "next/link"
import type { RelatedProjectCard as RelatedProject } from "@/lib/projects/related-projects"

export function RelatedProjectCard({ project }: { project: RelatedProject }) {
  return (
    <Link href={project.href} className="flex min-h-28.75 flex-col gap-1 rounded-[20px] border bg-card px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <span className="wrap-break-word text-base font-medium">{project.title}</span>
      {project.description ? <span className="line-clamp-3 wrap-break-word text-sm leading-tight text-muted-foreground">{project.description}</span> : null}
    </Link>
  )
}

export function RelatedProjectSection({ title, headingId, projects }: { title: string; headingId: string; projects: RelatedProject[] }) {
  if (!projects.length) return null
  return (
    <section className="mt-8 space-y-2" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-xl font-medium">{title}</h2>
      <ul className="space-y-2">
        {projects.map((project) => <li key={project.id}><RelatedProjectCard project={project} /></li>)}
      </ul>
    </section>
  )
}
