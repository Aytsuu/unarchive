import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export function ProjectListSkeleton() {
  return <section aria-label="Loading projects" className="mt-14" aria-busy="true">
    <Skeleton aria-hidden="true" className="h-5 w-20" />
    <span className="sr-only" role="status">Loading projects</span>
    <div aria-hidden="true" className="mt-3.75 grid grid-cols-1 gap-3.75 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, index) => <Card key={index} className={`min-h-86.75 gap-0 rounded-[20px] border border-border p-5 ring-0 ${index >= 9 ? "hidden xl:flex" : index >= 6 ? "hidden lg:flex" : index >= 3 ? "hidden sm:flex" : ""}`}>
        <Skeleton className="h-4 w-28" /><Skeleton className="mt-2 h-3 w-40" />
        <div className="mt-5 flex gap-1"><Skeleton className="size-7 rounded-full" /><Skeleton className="size-7 rounded-full" /></div>
        <Skeleton className="mt-3 h-6 w-4/5" /><Skeleton className="mt-2 h-6 w-3/5" />
        <Skeleton className="mt-3 h-4 w-full" /><Skeleton className="mt-2 h-4 w-4/5" />
        <Skeleton className="mt-auto h-4 w-28" /><Skeleton className="mt-6 h-9 w-22.25 self-end rounded-full" />
      </Card>)}
    </div>
  </section>
}
