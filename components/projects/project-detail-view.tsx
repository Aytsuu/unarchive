import Link from "next/link"
import type { ReactNode } from "react"
import type { HomeUser } from "@/components/home/account-menu"
import { HeaderActions } from "@/components/home/header-actions"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon, ViewIcon } from "@hugeicons/core-free-icons"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ProjectMetrics, type ProjectMetricsValue } from "@/components/projects/project-metrics"
import { ProjectTopics } from "@/components/projects/project-topics"
import { ProjectCitation } from "@/components/projects/project-citation"
import { ProjectVersionHistory, type ProjectVersionSummary } from "@/components/projects/project-version-history"
import type { CitationInput } from "@/lib/projects/citation"

export type ProjectDetail = {
  id: string
  title: string
  description?: string
  abstract?: string
  topics?: string[]
  institution?: string
  dateStarted?: string
  dateEnded?: string
  contributors?: string[]
  links?: string[]
  references?: { id: string; title: string }[]
  demoCount: number
  date: { label: string; iso: string } | null
  metrics: ProjectMetricsValue
  citation: CitationInput
  demoBase?: string
  versionHistory?: { versions: ProjectVersionSummary[]; nextBefore: number | null; displayedVersion: number; latestVersion: number; canEdit: boolean }
}

function safeLink(value: string) {
  try {
    const url = new URL(value)
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password ? url.href : null
  } catch { return null }
}

function formatMonth(value: string) {
  if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)) return null
  const date = new Date(`${value}-01T00:00:00Z`)
  return new Intl.DateTimeFormat("en", { month: "long", year: "numeric", timeZone: "UTC" }).format(date)
}

function InfoCard({ title, children, className }: { title: string; children?: ReactNode; className?: string }) {
  return (
    <Card className={`gap-2 rounded-[20px] border p-5 ring-0 ${className ?? ""}`}>
      <CardHeader className="gap-0 p-0"><CardTitle>{title}</CardTitle></CardHeader>
      {children && <CardContent className="space-y-2 p-0 text-sm">{children}</CardContent>}
    </Card>
  )
}

export function ProjectDetailView({ project, user }: { project: ProjectDetail; user: HomeUser | null }) {
  return (
    <main className="min-h-dvh bg-background pb-20 text-foreground">
      <header className="flex w-full items-center justify-between gap-4 px-5 pt-9.25 sm:pl-7.5 sm:pr-8.5">
        <div className="flex items-center gap-5.25 max-sm:gap-1">
          <Link href="/home" aria-label="Back to home" className={buttonVariants({ variant: "secondary", size: "icon" })}>
            <span aria-hidden="true" className="relative block size-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/publish/undo-curve.svg" alt="" className="absolute left-[1.75px] top-[5.9px]" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/publish/undo-arrow.svg" alt="" className="absolute left-[1.75px] top-[2.9px]" />
            </span>
          </Link>
          <span className="hidden text-xl font-medium sm:inline">Project</span>
        </div>
        <HeaderActions user={user} />
      </header>

      <article className="mx-auto mt-7.5 w-full max-w-360 px-5 lg:pl-21.25 lg:pr-12.5">
        <div className="flex min-h-8.75 flex-wrap items-center gap-x-4 gap-y-3">
          <ProjectTopics topics={project.topics ?? []} />
          <div className="ml-auto">{user ? <ProjectMetrics key={project.id} projectId={project.id} title={project.title} scope={user.id} initial={project.metrics} /> : <div className="flex items-center gap-3.25">
            <span className="inline-flex h-7 min-w-14.75 items-center justify-center gap-1.5 rounded-full border border-border px-2 text-sm" aria-label={`${project.metrics.views} views`}><HugeiconsIcon icon={ViewIcon} size={15} aria-hidden="true" />{project.metrics.views}</span>
            <span className="inline-flex h-7 min-w-14.75 items-center justify-center gap-1.5 rounded-full border border-border px-2 text-sm" aria-label={`${project.metrics.stars} stars`}><HugeiconsIcon icon={StarIcon} size={15} aria-hidden="true" />{project.metrics.stars}</span>
          </div>}</div>
        </div>
        <div className="mt-2.75 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,439px)] lg:gap-16">
        <div className="min-w-0">
          <h1 className="wrap-break-word text-[28px] font-medium leading-tight">{project.title}</h1>
          {project.description && <p className="mt-4 whitespace-pre-wrap wrap-break-word text-xl font-medium">{project.description}</p>}
          {(project.date || !!project.contributors?.length) && <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
            {project.date && <p>Published: <time dateTime={project.date.iso}>{project.date.label}</time></p>}
            {!!project.contributors?.length && <div className="flex flex-wrap items-center gap-2"><span>Author:</span><ul aria-label="Contributors" className="flex flex-wrap gap-1.75">{project.contributors.map((name, index) => <li key={`${index}-${name}`} className="max-w-full"><Badge variant="secondary" className="h-auto min-h-5 max-w-full whitespace-normal wrap-break-word">{name}</Badge></li>)}</ul></div>}
          </div>}
          {project.abstract && <section className="mt-12 space-y-2"><h2 className="text-xl font-medium">Abstract</h2><p className="whitespace-pre-wrap wrap-break-word leading-relaxed">{project.abstract}</p></section>}
        </div>

        <aside className="flex min-w-0 flex-col gap-5 lg:mt-3" aria-label="Project information">
          <InfoCard title="University/Institution" className="min-h-29.25">
            {project.institution && <p className="wrap-break-word text-muted-foreground">{project.institution}</p>}
            {project.dateStarted && formatMonth(project.dateStarted) && <p className="text-muted-foreground">Date started: <time dateTime={project.dateStarted}>{formatMonth(project.dateStarted)}</time></p>}
            {project.dateEnded && formatMonth(project.dateEnded) && <p className="text-muted-foreground">Date ended: <time dateTime={project.dateEnded}>{formatMonth(project.dateEnded)}</time></p>}
          </InfoCard>
          <InfoCard title="Links" className="min-h-42.5">
            {project.links?.map((link, index) => { const href = safeLink(link); return href ? <p key={`${index}-${link}`}><a className="break-all text-primary underline underline-offset-4" href={href} target="_blank" rel="noopener noreferrer">{link}</a></p> : null })}
          </InfoCard>
          {!!project.references?.length && <InfoCard title="Reference projects">
            <ul className="space-y-2">{project.references.map((reference) => <li key={reference.id}><Link className="wrap-break-word text-primary underline underline-offset-4" href={`/projects/${reference.id}`}>{reference.title}</Link></li>)}</ul>
          </InfoCard>}
          <InfoCard title="Demos" className="min-h-28.75">
            {project.demoCount > 0 && <div className="grid gap-4 sm:grid-cols-2">{Array.from({ length: project.demoCount }, (_, index) => (
              // Snapshot demo endpoints serve sanitized uploads with varying dimensions.
              // eslint-disable-next-line @next/next/no-img-element
              <img key={index} src={`${project.demoBase ?? `/api/projects/${project.id}/demos`}/${index}`} alt={`Demo ${index + 1} for ${project.title}`} className="h-auto w-full rounded-xl border border-border" loading="lazy" />
            ))}</div>}
          </InfoCard>
          <ProjectCitation {...project.citation} />
          {project.versionHistory && <ProjectVersionHistory projectId={project.id} {...project.versionHistory} />}
        </aside>
        </div>
      </article>
    </main>
  )
}
