"use client"

import { useRouter } from "next/navigation"
import { AdvancedFilters, type TopicFilters } from "@/components/topics/advanced-filters"
import { ProjectCard, type HomeProject } from "@/components/home/home-screen"
import { Button, buttonVariants } from "@/components/ui/button"
import Link from "next/link"
import { topicSlug } from "@/lib/projects/topic-slug.mjs"

function filtersToParams(filters: TopicFilters, page: number, pageSize: number) {
  const params = new URLSearchParams({ page: String(page), size: String(pageSize) })
  if (filters.search.trim()) params.set("q", filters.search.trim())
  if (filters.sort) params.set("sort", filters.sort)
  if (filters.yearFrom) params.set("from", filters.yearFrom)
  if (filters.yearTo) params.set("to", filters.yearTo)
  for (const institution of filters.institutions) params.append("institution", institution)
  return params
}

export function TopicListing({ topic, projects, total, page, pageSize, filters, scope, isFetching = false }: { topic: string; projects: HomeProject[]; total: number; page: number; pageSize: number; filters: TopicFilters; scope: string; isFetching?: boolean }) {
  const router = useRouter()
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const slug = topicSlug(topic)

  function hrefFor(next: Partial<TopicFilters> & { page?: number }) {
    const params = filtersToParams({ ...filters, ...next }, next.page ?? 1, pageSize)
    return `/topics/${slug}?${params}`
  }

  return (
    <section aria-labelledby="topic-count" aria-busy={isFetching || undefined}>
      <div className="flex items-center justify-between gap-3">
        <p id="topic-count" className="text-base font-medium">
          {total.toLocaleString()} <span className="text-sm font-medium text-muted-foreground">items</span>
        </p>
        <AdvancedFilters value={filters} onChange={(next) => router.replace(hrefFor(next), { scroll: false })} />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3.75 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {projects.map((project) => <ProjectCard key={project.id} project={project} scope={scope} />)}
      </div>
      {projects.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">No projects match these filters.</p>}
      {pages > 1 && <nav aria-label="Project pagination" className="mt-6 flex items-center justify-center gap-4">
        {page > 1 ? <Link href={hrefFor({ page: page - 1 })} className={buttonVariants({ variant: "outline" })}>Previous</Link> : <Button variant="outline" disabled>Previous</Button>}
        <span className="text-sm text-muted-foreground" aria-live="polite">Page {page} of {pages}</span>
        {page < pages ? <Link href={hrefFor({ page: page + 1 })} className={buttonVariants({ variant: "outline" })}>Next</Link> : <Button variant="outline" disabled>Next</Button>}
      </nav>}
    </section>
  )
}
