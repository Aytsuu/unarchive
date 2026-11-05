import Image from "next/image"
import Link from "next/link"
import { buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { AccountMenu, type HomeUser } from "@/components/home/account-menu"
import searchIcon from "@/components/home/search.svg"

export type HomeProject = { id: string; title: string; description: string; institution: string }

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
      <header className="flex h-18.75 items-center justify-between px-5 pt-8.75 sm:pl-11.5 sm:pr-8.5">
        <Link href="/home" className="text-xl font-medium">Unarchive</Link>
        {user ? <AccountMenu user={user} /> : <span className={buttonVariants({ variant: "secondary", size: "sm", className: "w-[75px]" })}>Guest</span>}
      </header>

      <div className="mx-auto mt-18.25 flex w-[min(662px,calc(100%-40px))] items-center gap-1.75 sm:translate-x-10">
        <form action="/home" role="search" className="min-w-0 flex-1">
          <div className="relative min-w-0 flex-1">
            <Image src={searchIcon} alt="" className="pointer-events-none absolute left-1.75 top-1/2 -translate-y-1/2" />
            <Input aria-label="Search capstone projects" name="q" defaultValue={search} maxLength={100} placeholder={`Search from ${total} published ${total === 1 ? "project" : "projects"}`} className="pl-10" />
          </div>
        </form>
        <Link href={user ? "/publish" : "/login"} className={buttonVariants()}>Publish</Link>
      </div>

      <div className="relative mx-auto mt-15.75 max-w-331.25 px-5 sm:px-0">
        <div className="grid grid-cols-1 gap-3.75 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project) => <ProjectCard key={project.id} project={project} />)}
        </div>
        {projects.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">{search ? "No projects match your search." : "No projects have been published yet."}</p>}
        {total > projects.length && <p className="mt-5 text-center text-sm text-muted-foreground">Showing the latest {projects.length} of {total} projects.</p>}
        {!user && (
          <div className="mt-12 flex flex-col items-center px-5 text-center">
            <p className="text-sm font-medium leading-normal">Sign in to your account or to continue<br className="hidden sm:block" /> browsing and be able to publish your works.</p>
            <div className="mt-7.5 flex gap-2.25">
              <Link href="/login" className={buttonVariants({ variant: "secondary", className: "w-[119px]" })}>Log in</Link>
              <Link href="/signup" className={buttonVariants({ className: "w-[119px]" })}>Get Started</Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
