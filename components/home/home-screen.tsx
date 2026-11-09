import Link from "next/link"
import { BookOpen01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { AccountMenu, type HomeUser } from "@/components/home/account-menu"
import { HomeSearch } from "@/components/home/home-search"

export type HomeProject = { id: string; title: string; description: string; institution: string }

const topics = [
  { name: "AI & Data Science", color: "bg-[#ede9fe]", icon: "ai" },
  { name: "Health & Medicine", color: "bg-[#fce7f3]", icon: "health", transform: "-scale-x-100" },
  { name: "Education & Learning", color: "bg-[#dbeafe]", icon: "education" },
  { name: "Environment & Sustainability", color: "bg-[#dcfce7]", icon: "environment" },
  { name: "Smart Cities & IoT", color: "bg-[#cffafe]", icon: "cities", transform: "-scale-y-100" },
  { name: "Agriculture & Food", color: "bg-[#fef3c7]", icon: "agriculture" },
  { name: "Business & Finance", color: "bg-[#ffedd5]", icon: "business" },
  { name: "Public Safety & Governance", color: "bg-[#fee2e2]", icon: "safety-verified" },
]

function ProjectCard({ project }: { project: HomeProject }) {
  return (
    <Link href={`/projects/${project.id}`} className="block rounded-[20px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      <Card className="h-42.5 gap-2 rounded-[20px] border border-border p-5 ring-0 transition-colors hover:bg-muted/40">
        <CardHeader className="gap-2 p-0">
          <CardTitle className="line-clamp-2 wrap-break-word">{project.title}</CardTitle>
          {project.institution && <CardDescription className="line-clamp-1">{project.institution}</CardDescription>}
        </CardHeader>
        {project.description && <CardContent className="line-clamp-3 wrap-break-word p-0">{project.description}</CardContent>}
      </Card>
    </Link>
  )
}

export function HomeScreen({ user, projects, total, search }: { user: HomeUser | null; projects: HomeProject[]; total: number; search: string }) {
  return (
    <main className="min-h-dvh bg-background pb-16 text-foreground">
      <header className="flex items-center justify-between gap-2 px-3 pt-9.25 sm:gap-4 sm:pl-11.5 sm:pr-8.5">
        <Link href="/home" className="text-base font-medium sm:text-xl">Unarchive</Link>
        <div className="flex items-center gap-1 sm:gap-3">
          {user && <Link href="/publish" className={buttonVariants({ className: "gap-2.5 max-sm:px-2" })}><HugeiconsIcon icon={BookOpen01Icon} aria-hidden="true" />Publish</Link>}
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
            {topics.map((topic) => <div key={topic.name} className={`flex min-h-15 items-center gap-3 rounded-[20px] px-5 py-2 text-base font-medium leading-tight ${topic.color}`}>
              <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/assets/icons/topics/${topic.icon}.svg`} alt="" className={topic.transform} />
              </span>
              <span>{topic.name}</span>
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
            {total > projects.length && <p className="mt-5 text-center text-sm text-muted-foreground">Showing the latest {projects.length} of {total} projects.</p>}
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
