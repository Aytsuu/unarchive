"use client"

import { useQuery } from "@tanstack/react-query"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { StatisticsSkeleton } from "@/components/home/home-skeletons"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { topicStyles } from "@/components/projects/topic-icon"
import { bubbleDiameter, institutionShare } from "@/lib/projects/institution-bubbles.mjs"

type Count = { name: string; count: number }
type Statistics = { totalProjects: number; institutions: Count[]; topics: Count[] }

const bubbleColors = ["bg-primary text-primary-foreground", "bg-violet-300 text-violet-950", "bg-violet-950 text-white", "bg-violet-200 text-violet-950", "bg-violet-500 text-white"]
const cardClass = "min-w-0 rounded-[20px] border border-border p-5 ring-0"

function InstitutionCard({ institutions }: { institutions: Count[] }) {
  const total = institutions.reduce((sum, item) => sum + item.count, 0)
  const maximum = institutions.reduce((max, item) => Math.max(max, item.count), 0)
  return <Card className={cardClass}>
    <div><p className="text-xs text-muted-foreground">Project distribution</p><h3 className="mt-1 text-base font-medium">Universities & institutions</h3></div>
    {institutions.length ? <>
      <div className="flex max-h-56 flex-wrap items-center justify-center gap-2 overflow-y-auto py-2" aria-label="Institution project distribution">
        {institutions.map((institution, index) => {
          const diameter = bubbleDiameter(institution.count, maximum, institutions.length)
          const share = institutionShare(institution.count, total)
          const description = `${institution.name}: ${institution.count.toLocaleString()} ${institution.count === 1 ? "project" : "projects"}`
          return <Tooltip key={institution.name}>
            <TooltipTrigger aria-label={description} className={`inline-flex shrink-0 items-center justify-center rounded-full text-sm font-medium outline-none transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${bubbleColors[index % bubbleColors.length]}`} style={{ width: `clamp(44px, ${diameter / 3.2}vw, ${diameter}px)`, aspectRatio: "1" }}>
              {share === 0 ? "<1" : share}%
            </TooltipTrigger>
            <TooltipContent>{description}</TooltipContent>
          </Tooltip>
        })}
      </div>
    </> : <p className="my-auto text-sm text-muted-foreground">Institution statistics will appear when projects list an institution.</p>}
  </Card>
}

function TopicsCard({ topics }: { topics: Count[] }) {
  const total = topics.reduce((sum, topic) => sum + topic.count, 0)
  return <Card className={cardClass}>
    <div><p className="text-xs text-muted-foreground">Project Distribution</p><h3 className="mt-1 text-base font-medium">Topics published</h3></div>
    {total ? <>
      <div aria-hidden="true" className="flex h-5 w-full overflow-hidden rounded-full bg-secondary">{topics.map((topic) => <span key={topic.name} className={topicStyles[topic.name]?.color ?? "bg-muted-foreground"} style={{ width: `${topic.count / total * 100}%` }} />)}</div>
      <ul className="flex max-h-36 flex-wrap content-start gap-x-3 gap-y-2 overflow-y-auto text-xs">{topics.map((topic) => <li key={topic.name} className="inline-flex items-center gap-1.5"><span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full ${topicStyles[topic.name]?.color ?? "bg-muted-foreground"}`} /><span>{topic.name}</span><span className="text-muted-foreground">{topic.count.toLocaleString()}</span></li>)}</ul>
    </> : <p className="my-auto text-sm text-muted-foreground">Topic statistics will appear as projects are published.</p>}
  </Card>
}

export function HomeStatistics() {
  const query = useQuery({ queryKey: ["project-statistics"], staleTime: 30_000, queryFn: async ({ signal }): Promise<Statistics> => {
    const response = await fetch("/api/projects/statistics", { signal, cache: "no-store" })
    if (!response.ok) throw new Error("Unable to load statistics")
    return (await response.json()).data
  } })
  return <section aria-label="Project statistics" className="mb-10">
    {query.isPending ? <StatisticsSkeleton /> : query.data ? <div className="grid items-stretch gap-3.75 md:grid-cols-2"><InstitutionCard institutions={query.data.institutions} /><TopicsCard topics={query.data.topics} /></div> : <div role="alert" className="rounded-[20px] border border-border p-5 text-sm"><p>Unable to load project statistics.</p><Button variant="outline" className="mt-3" onClick={() => query.refetch()}>Retry</Button></div>}
  </section>
}
