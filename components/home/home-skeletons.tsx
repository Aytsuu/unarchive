import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function StatisticsSkeleton() {
  return <div role="status" aria-label="Loading project statistics" aria-busy="true" className="grid gap-3.75 md:grid-cols-2">
    {[0, 1].map((item) => <Card key={item} aria-hidden="true" className="min-h-60 gap-4 rounded-[20px] border border-border p-5 ring-0">
      <Skeleton className="h-3 w-28" /><Skeleton className="h-5 w-44" />
      {item === 0 ? <div className="flex flex-1 items-center justify-center gap-3"><Skeleton className="size-20 rounded-full" /><Skeleton className="size-14 rounded-full" /><Skeleton className="size-12 rounded-full" /></div> : <><Skeleton className="mt-6 h-5 w-full rounded-full" /><Skeleton className="mt-2 h-3 w-4/5" /><Skeleton className="h-3 w-3/5" /></>}
    </Card>)}
  </div>
}

export function TopicsSkeleton() {
  return <section aria-label="Loading topics" aria-busy="true">
    <span role="status" className="sr-only">Loading topics</span>
    <Skeleton aria-hidden="true" className="h-5 w-16" />
    <div aria-hidden="true" className="mt-4 grid grid-cols-1 gap-3.75 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-15 rounded-[20px]" />)}</div>
  </section>
}
