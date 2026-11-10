import Link from "next/link"
import Image from "next/image"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { HugeiconsIcon } from "@hugeicons/react"
import { StarIcon, UserGroupIcon, ViewIcon } from "@hugeicons/core-free-icons"
import { topicStyles, TopicIcon } from "@/components/projects/topic-icon"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AccountMenu, type HomeUser } from "@/components/home/account-menu"
import { HomeSearch } from "@/components/home/home-search"
import { BrandLogo } from "@/components/brand/brand-logo"
import { ResponsivePageSize } from "@/components/home/responsive-page-size"

export type HomeProject = { id: string; title: string; description: string; institution: string; publisher: string; topics: string[]; views: number; stars: number; collaborators: number }

function ProjectCard({ project }: { project: HomeProject }) {
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
        <Link href={`/projects/${project.id}`} className={buttonVariants({ className: "mt-6 w-full" })}>Read more details</Link>
    </Card>
  )
}

export function HomeScreen({ user, projects, total, search, page, pageSize }: { user: HomeUser | null; projects: HomeProject[]; total: number; search: string; page: number; pageSize: number }) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  function pageHref(target: number) {
    const params = new URLSearchParams({ page: String(target), size: String(pageSize) })
    if (search) params.set("q", search)
    return `/home?${params.toString()}`
  }
  return (
    <main className="min-h-dvh bg-background pb-16 text-foreground">
      {user && <ResponsivePageSize pageSize={pageSize} />}
      <header className="flex items-center justify-between gap-2 px-3 pt-9.25 sm:gap-4 sm:pl-11.5 sm:pr-8.5">
        <Link href="/home" className="text-base font-medium sm:text-xl"><BrandLogo compactOnSmallScreens /></Link>
        <div className="flex items-center gap-1 sm:gap-3">
          {user && <Link href="/publish" className={buttonVariants({ className: "gap-2.5 max-sm:px-2" })}><Image src="/assets/icons/publish/archive.svg" alt="" width={16} height={16} className="brightness-0 invert" />Publish</Link>}
          <HomeSearch search={search} projects={projects} />
          {user && <Popover>
            <PopoverTrigger render={<Button type="button" variant="outline" size="icon" aria-label="Notifications" />}>
              <span aria-hidden="true" className="flex size-6 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/assets/icons/notification.svg" alt="" className="h-4 w-auto" />
              </span>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64">
              <p className="text-sm text-muted-foreground">Notifications are coming soon.</p>
            </PopoverContent>
          </Popover>}
          {user ? <AccountMenu user={user} avatarClassName="size-9" /> : <span className={buttonVariants({ variant: "secondary", size: "sm", className: "w-[75px]" })}>Guest</span>}
        </div>
      </header>

      <div className="mx-auto mt-12.75 w-full max-w-341.5 px-5 sm:px-5">
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

        <section aria-labelledby="projects-heading" className="mt-14">
          <h2 id="projects-heading" className="text-base font-medium leading-5">Projects</h2>
          {search && <p className="mt-2 text-sm text-muted-foreground">Results for “{search}” · <Link href="/home" className="underline underline-offset-4">Clear search</Link></p>}
          <div className={`relative mt-3.75 ${!user ? "min-h-115" : ""}`}>
            <div className="grid grid-cols-1 gap-3.75 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
            </div>
            {projects.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{search ? "No projects match your search." : "No projects have been published yet."}</p>}
            {user && pages > 1 && <nav aria-label="Project pagination" className="mt-6 flex items-center justify-center gap-4">
              {page > 1 ? <Link href={pageHref(page - 1)} className={buttonVariants({ variant: "outline" })}>Previous</Link> : <Button variant="outline" disabled>Previous</Button>}
              <span className="text-sm text-muted-foreground" aria-live="polite">Page {page} of {pages}</span>
              {page < pages ? <Link href={pageHref(page + 1)} className={buttonVariants({ variant: "outline" })}>Next</Link> : <Button variant="outline" disabled>Next</Button>}
            </nav>}
            {!user && (
              <div className="absolute inset-x-0 top-30 bottom-0 flex flex-col items-center bg-background/90 px-5 pt-33 text-center backdrop-blur-[2px]">
                <p className="text-sm font-medium leading-normal">Sign in to your account to continue<br className="hidden sm:block" /> browsing and publish your work.</p>
                <div className="mt-7.5 flex gap-2.25">
                  <Link href="/login" className={buttonVariants({ variant: "secondary", className: "w-[119px]" })}>Log in</Link>
                  <Link href="/signup" className={buttonVariants({ className: "w-[119px]" })}>Get Started</Link>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
