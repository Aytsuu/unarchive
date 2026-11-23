import Link from "next/link"
import type { ReactNode } from "react"
import { HugeiconsIcon } from "@hugeicons/react"
import { MicroscopeIcon, StudentIcon, UniversityIcon } from "@hugeicons/core-free-icons"
import { LandingFooter } from "@/components/landing/landing-footer"
import { LandingHeader } from "@/components/landing/landing-header"
import { TopicIcon, topicStyles } from "@/components/projects/topic-icon"
import { buttonVariants } from "@/components/ui/button"
import { landingAccountLinks, landingExploreHref, landingGetStartedHref, landingPublishHref, landingTopicTiles } from "@/lib/landing/links"
import { cn } from "@/lib/utils"

export type LandingPreviewProject = { id: string; title: string; description: string }

const audiences = [
  { title: "Students", icon: StudentIcon, description: "Discover work from other universities and find a stronger starting point for your next project." },
  { title: "Researchers", icon: MicroscopeIcon, description: "Explore related studies, identify new questions, and give credit to the people who came before." },
  { title: "Institutions", icon: UniversityIcon, description: "Bring visibility to student research beyond the walls of your institution." },
] as const

const features = [
  { previewFirst: false, href: "/home", label: "DISCOVER", title: "Explore published projects", description: "Search across projects, topics, and institutions." },
  { previewFirst: true, href: "/publish", label: "PUBLISH", title: "Share your research", description: "Give your project a public home." },
  { previewFirst: false, href: "/publish", label: "CONTEXT", title: "Tell the full story", description: "Bring your abstract, links, and demos together." },
  { previewFirst: true, href: "/publish", label: "COLLABORATE", title: "Credit your contributors", description: "Keep the people behind each project visible." },
  { previewFirst: false, href: "/terms#terms-citations", label: "REFERENCE", title: "Cite published work", description: "Copy a citation and reference a preserved version." },
  { previewFirst: true, href: "/home", label: "SAVE", title: "Keep ideas close", description: "Save projects you want to return to later." },
] as const

const impact = [
  { step: "01 / DISCOVER", title: "Find what exists", description: "See theses, capstones, and studies from other universities that might otherwise go unnoticed." },
  { step: "02 / UNDERSTAND", title: "Recognize prior work", description: "Learn what has been explored, identify open questions, and give original researchers credit." },
  { step: "03 / ADVANCE", title: "Take an idea further", description: "Use those insights to shape new questions, approaches, and research with a distinct purpose." },
] as const

const samplePreviews: LandingPreviewProject[] = [
  { id: "", title: "Campus Resource Navigator", description: "A searchable guide to student resources." },
  { id: "", title: "Community Flood Readiness", description: "Mapping information for local preparedness." },
  { id: "", title: "Accessible Campus Routes", description: "A more inclusive way to navigate campus." },
]

function MockPreview({ title }: { title: string }) {
  return (
    <div className="flex min-h-50 w-full flex-col gap-3 overflow-hidden rounded-2xl bg-background p-5">
      <div className="flex items-center gap-3.5 text-[11px] text-muted-foreground">
        <span aria-hidden="true">●  ●  ●</span>
        <span className="text-[13px] font-medium text-foreground">{title}</span>
      </div>
      <div className="flex gap-2.5">
        <div className="flex h-30 w-32.5 shrink-0 flex-col gap-2 rounded-[10px] bg-muted p-3">
          <p className="text-[9px] font-medium text-primary">PROJECT</p>
          <p className="text-sm font-semibold">Research</p>
        </div>
        <div className="flex min-w-0 flex-col gap-2 pt-2">
          <p className="text-sm font-medium">A place for meaningful work</p>
          <p className="text-xs text-muted-foreground">Title, authors and institution</p>
          <p className="text-xs font-medium text-primary">Read the project →</p>
        </div>
      </div>
    </div>
  )
}

function FeatureCard({ previewFirst, href, label, title, description }: (typeof features)[number]) {
  const copy = (
    <>
      <p className="text-[11px] font-medium tracking-wide text-primary">{label}</p>
      <h3 className="text-[25px] font-semibold leading-tight">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </>
  )
  return (
    <Link href={href} className="flex flex-col gap-4 rounded-[24px] border border-border bg-muted px-7 py-7 outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {previewFirst ? <MockPreview title={title} /> : copy}
      {previewFirst ? copy : <MockPreview title={title} />}
    </Link>
  )
}

export function LandingAccountNav({ signedIn }: { signedIn: boolean }) {
  return (
    <nav aria-label="Account" className="flex items-center gap-3 transition-[gap] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none group-data-[compact=true]/header:gap-2.5">
      {landingAccountLinks(signedIn).map((link) => (
        <Link
          key={link.label}
          href={link.href}
          className={cn(
            buttonVariants({ variant: link.label === "Log in" ? "ghost" : "default" }),
            "transition-[min-width,border-color,background-color] duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] motion-reduce:transition-none group-data-[compact=true]/header:h-9 group-data-[compact=true]/header:min-w-26",
            link.label === "Log in" && "group-data-[compact=true]/header:border-border group-data-[compact=true]/header:bg-background/80",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  )
}

export function LandingPreviewCards({ projects }: { projects: LandingPreviewProject[] }) {
  const explore = landingExploreHref()
  const previews = projects.length ? projects.slice(0, 3) : samplePreviews
  return (
    <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {previews.map((project) => {
        const href = project.id ? `/projects/${project.id}` : explore
        return (
          <li key={`${project.id}-${project.title}`}>
            <Link href={href} className="flex h-full flex-col gap-3 rounded-[18px] border border-border p-5.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <p className="text-[11px] font-medium text-primary">RESEARCH PROJECT</p>
              <p className="text-xl font-semibold leading-tight">{project.title}</p>
              <p className="text-[13px] text-muted-foreground">{project.description}</p>
              <p className="mt-auto text-[13px] font-medium text-primary">View project →</p>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

export function LandingGetStarted({ signedIn }: { signedIn: boolean }) {
  return <Link href={landingGetStartedHref(signedIn)} className={buttonVariants({ size: "lg", className: "mt-5 h-11.75 px-7 text-[15px]" })}>Get Started →</Link>
}

export function LandingPage({ account, previews, getStarted }: { account: ReactNode; previews: ReactNode; getStarted: ReactNode }) {
  const explore = landingExploreHref()
  const publish = landingPublishHref()
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <LandingHeader account={account} />

      <main className="flex-1">
        <section className="mx-auto flex w-full max-w-250 flex-col items-center gap-6 px-5 py-21 text-center">
          <h1 className="w-full max-w-250 text-[40px] font-semibold leading-[1.05] tracking-[-1.6px] sm:text-[75px] sm:leading-[70px] sm:tracking-[-3px]">Research deserves a<br />life beyond the archive</h1>
          <p className="max-w-[550px] text-base leading-normal text-muted-foreground sm:text-[20px]">Discover academic projects, share your work, and build on the ideas that came before you.</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link href={explore} className={cn(buttonVariants(), "h-auto rounded-full px-6 py-3.5 text-sm font-medium")}>Explore projects →</Link>
            <Link href={publish} className={cn(buttonVariants({ variant: "ghost" }), "h-auto rounded-full border-border bg-background px-6 py-3.5 text-sm font-medium")}>Publish your work</Link>
          </div>
        </section>

        <section className="px-5 py-16 sm:px-10 lg:px-20">
          <div className="mx-auto flex w-full max-w-280 flex-col items-center gap-6 rounded-[28px] bg-primary px-6 py-10 text-center text-primary-foreground sm:px-12 sm:py-10.5">
            <h2 className="text-2xl font-bold sm:text-[30px]">A place for ideas to be discovered</h2>
            <p className="text-base text-primary-foreground/90">Explore published work from across disciplines.</p>
            <div className="w-full rounded-[20px] bg-background p-6 text-left text-foreground sm:p-8">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <p className="text-[17px] font-bold">unarchive</p>
                <Link href={explore} className="min-w-40 flex-1 rounded-full bg-muted px-4 py-2.5 text-sm text-muted-foreground">Search projects</Link>
                <Link href={explore} className={buttonVariants({ className: "px-6" })}>Explore</Link>
              </div>
              {previews}
            </div>
          </div>
        </section>

        <section id="who" className="mx-auto max-w-267.5 scroll-mt-8 px-5 py-21 text-center">
          <h2 className="text-3xl font-semibold sm:text-[36px]">Who is Unarchive for?</h2>
          <ul className="mt-11 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {audiences.map((audience) => (
              <li key={audience.title} className="flex flex-col items-center gap-3">
                <HugeiconsIcon icon={audience.icon} size={30} strokeWidth={1.5} className="text-primary" aria-hidden="true" />
                <h3 className="text-[22px] font-semibold">{audience.title}</h3>
                <p className="max-w-75 text-sm text-muted-foreground">{audience.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="mx-auto max-w-278 px-5 py-21">
          <div className="text-center">
            <h2 className="text-[32px] font-semibold sm:text-[38px]">Make great work easier to find</h2>
            <p className="mx-auto mt-6 max-w-175 text-base text-muted-foreground">A simple home for the research journey, from first discovery to lasting reference.</p>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
          </div>
          <Link href={explore} className="mt-6 flex flex-col items-start gap-12 overflow-hidden rounded-[24px] bg-primary px-8 py-8 text-primary-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring lg:flex-row lg:items-center lg:px-10.5">
            <div className="max-w-100">
              <p className="text-[11px] font-medium">CONNECT THE DOTS</p>
              <h3 className="mt-3 text-[30px] font-bold leading-tight">Build on what came before</h3>
              <p className="mt-3 text-[15px] text-primary-foreground/90">Find related work across universities, acknowledge its authors, and take the next question further.</p>
            </div>
            <MockPreview title="Referenced projects" />
          </Link>
        </section>

        <section id="topics" className="mx-auto max-w-261.5 scroll-mt-8 px-5 py-21 text-center">
          <h2 className="text-3xl font-bold sm:text-[36px]">Explore ideas across disciplines</h2>
          <p className="mx-auto mt-6 max-w-175 text-base text-muted-foreground">Find projects connected by the questions, communities, and fields that matter to you.</p>
          <ul className="mt-6 grid grid-cols-1 gap-4.5 sm:grid-cols-2 lg:grid-cols-4">
            {landingTopicTiles().map((tile) => (
              <li key={tile.name}>
                <Link href={tile.href} className={cn("flex min-h-18.5 items-center gap-3 rounded-[18px] px-5 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring", topicStyles[tile.name]?.color ?? "bg-muted")}>
                  <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center"><TopicIcon topic={tile.name} size={24} /></span>
                  <span>{tile.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section className="px-5 py-16 sm:px-10 lg:px-20">
          <div className="mx-auto flex w-full max-w-278 flex-col items-start justify-between gap-8 rounded-[24px] bg-primary px-8 py-12 text-primary-foreground sm:flex-row sm:items-center sm:px-12.5">
            <div>
              <h2 className="text-[28px] font-bold leading-tight sm:text-[34px]">Every project can be a starting point</h2>
              <p className="mt-2.5 text-base text-primary-foreground/90">Discover existing work and find room for your next idea.</p>
            </div>
            <Link href={explore} className={buttonVariants({ variant: "secondary", size: "lg", className: "h-11.5 shrink-0 bg-background px-6.5 text-primary hover:bg-background/90" })}>Explore projects →</Link>
          </div>
        </section>

        <section className="mx-auto max-w-271.5 px-5 py-21 text-center">
          <h2 className="text-3xl font-bold sm:text-[36px]">Better visibility. Stronger research.</h2>
          <p className="mx-auto mt-6 max-w-175 text-[15px] text-muted-foreground">When student work is easier to find, researchers can recognize prior efforts and explore what comes next.</p>
          <ul className="mt-6 grid gap-4.5 md:grid-cols-3">
            {impact.map((item) => (
              <li key={item.step} className="rounded-[20px] border border-border bg-background p-6.5 text-left">
                <p className="text-xs font-medium text-primary">{item.step}</p>
                <h3 className="mt-4 text-2xl font-semibold">{item.title}</h3>
                <p className="mt-4 text-[15px] text-muted-foreground">{item.description}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="bg-muted px-5 py-20 text-center">
          <h2 className="text-[32px] font-bold sm:text-[42px]">Ready to share your work?</h2>
          <p className="mx-auto mt-5 max-w-175 text-[17px] text-muted-foreground">Give your project a place to be discovered.</p>
          {getStarted}
        </section>
      </main>

      <LandingFooter />
      <p aria-hidden="true" className="pointer-events-none m-0 block h-[0.75em] w-full overflow-hidden text-center text-[clamp(4.5rem,12.5vw,11.25rem)] leading-none font-bold text-primary/20">Unarchive</p>
    </div>
  )
}
