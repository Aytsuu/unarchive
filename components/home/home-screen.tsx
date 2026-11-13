import Link from "next/link"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon, UserGroupIcon, ViewIcon } from "@hugeicons/core-free-icons"
import { topicStyles, TopicIcon } from "@/components/projects/topic-icon"
import type { HomeUser } from "@/components/home/account-menu"
import { HeaderActions } from "@/components/home/header-actions"
import type { ReactNode } from "react"
import { HomeStatistics } from "@/components/home/home-statistics"
import { BrandLogo } from "@/components/brand/brand-logo"
import { ResponsivePageSize } from "@/components/home/responsive-page-size"
import { ProjectSaveButton } from "@/components/projects/project-save-button"

export type HomeProject = { id: string; title: string; description: string; institution: string; publisher: string; topics: string[]; views: number; stars: number; collaborators: number; saved?: boolean }

function ProjectCard({ project, scope }: { project: HomeProject; scope: string }) {
  return (
    <Card className="min-h-86.75 gap-0 rounded-[20px] border border-border p-5 ring-0">
        <div className="min-w-0">
          <p className="truncate text-sm">{project.publisher}</p>
          <p className="truncate text-xs text-muted-foreground">{project.institution || "\u00a0"}</p>
        </div>
        <ul aria-label="Project topics" className="mt-5 flex flex-wrap gap-1">
          {project.topics.map((topic) => <li key={topic} title={topic} aria-label={topic} className={`flex size-7 shrink-0 items-center justify-center rounded-full ${topicStyles[topic]?.color ?? "bg-secondary"}`}><span className="flex items-center justify-center opacity-60"><TopicIcon topic={topic} size={14} /></span></li>)}
        </ul>
        <h3 className="mt-2 line-clamp-2 wrap-break-word text-[22px] leading-tight font-medium">{project.title}</h3>
        <p className="mt-3 line-clamp-3 wrap-break-word text-sm leading-tight text-muted-foreground">{project.description}</p>
        <div className="mt-auto flex items-center gap-4 pt-5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1" aria-label={`${project.views} views`}><HugeiconsIcon icon={ViewIcon} size={15} aria-hidden="true" />{project.views}</span>
          <span className="inline-flex items-center gap-1" aria-label={`${project.stars} stars`}><HugeiconsIcon icon={StarIcon} size={15} aria-hidden="true" />{project.stars}</span>
          <span className="inline-flex items-center gap-1" aria-label={`${project.collaborators} collaborators including publisher`}><HugeiconsIcon icon={UserGroupIcon} size={15} aria-hidden="true" />{project.collaborators}</span>
        </div>
        <div className="mt-6 flex items-start justify-end gap-2">
          {scope !== "guest" && <ProjectSaveButton projectId={project.id} title={project.title} scope={scope} initialSaved={project.saved} />}
          <Link href={`/projects/${project.id}`} aria-label={`Read ${project.title}`} className={buttonVariants({ className: "w-22.25" })}>Read</Link>
        </div>
    </Card>
  )
}

export function ProjectListing({ projects, total, search, page, pageSize, scope }: { projects: HomeProject[]; total: number; search: string; page: number; pageSize: number; scope: string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  function pageHref(target: number) {
    const params = new URLSearchParams({ page: String(target), size: String(pageSize) })
    if (search) params.set("q", search)
    return `/home?${params.toString()}`
  }
  return (
        <section aria-labelledby="projects-heading" className="mt-14">
          <h2 id="projects-heading" className="text-base font-medium leading-5">Projects</h2>
          {search && <p className="mt-2 text-sm text-muted-foreground">Results for “{search}” · <Link href="/home" className="underline underline-offset-4">Clear search</Link></p>}
          <div className="mt-3.75">
            <div className="grid grid-cols-1 gap-3.75 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => <ProjectCard key={project.id} project={project} scope={scope} />)}
            </div>
            {projects.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{search ? "No projects match your search." : "No projects have been published yet."}</p>}
            {pages > 1 && <nav aria-label="Project pagination" className="mt-6 flex items-center justify-center gap-4">
              {page > 1 ? <Link href={pageHref(page - 1)} className={buttonVariants({ variant: "outline" })}>Previous</Link> : <Button variant="outline" disabled>Previous</Button>}
              <span className="text-sm text-muted-foreground" aria-live="polite">Page {page} of {pages}</span>
              {page < pages ? <Link href={pageHref(page + 1)} className={buttonVariants({ variant: "outline" })}>Next</Link> : <Button variant="outline" disabled>Next</Button>}
            </nav>}
          </div>
        </section>
  )
}

export function HomeScreen({ user, pageSize, searchControl, topicsContent, children }: { user: HomeUser | null; pageSize: number; searchControl: ReactNode; topicsContent: ReactNode; children: ReactNode }) {
  return (
    <main className="min-h-dvh bg-background pb-16 text-foreground">
      <ResponsivePageSize pageSize={pageSize} />
      <header className="flex items-center justify-between gap-2 px-3 pt-9.25 sm:gap-4 sm:pl-11.5 sm:pr-8.5">
        <Link href="/home" className="text-base font-medium sm:text-xl"><BrandLogo compactOnSmallScreens /></Link>
        <HeaderActions user={user} searchControl={searchControl} />
      </header>

      <div className="mx-auto mt-12.75 w-full max-w-341.5 px-5 sm:px-5">
        <HomeStatistics />
        {topicsContent}

        {children}
      </div>
    </main>
  )
}

export function HomeTopics() {
  return (
        <section aria-labelledby="topics-heading">
          <h1 id="topics-heading" className="text-base font-medium leading-5">Topics</h1>
          <div className="mt-4 grid grid-cols-1 gap-3.75 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Object.entries(topicStyles).map(([name, topic]) => <div key={name} className={`flex min-h-15 items-center gap-3 rounded-[20px] px-5 py-2 text-base font-medium leading-tight ${topic.color}`}>
              <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center">
                <TopicIcon topic={name} size={24} />
              </span>
              <span>{name}</span>
            </div>)}
          </div>
        </section>

  )
}
