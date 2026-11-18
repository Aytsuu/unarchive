import Link from "next/link"
import { ARCHIVED_SNAPSHOT_HEADING, archivedSnapshotDescription } from "@/lib/projects/archived-snapshot"

export function ArchivedSnapshotBanner({ projectId, publishedAt }: { projectId: string; publishedAt: string }) {
  const description = archivedSnapshotDescription(new Date(publishedAt))
  if (!description) return null
  return (
    <aside className="mb-8 max-w-3xl rounded-[20px] border border-border px-5 py-4" role="status">
      <p className="text-base font-medium">{ARCHIVED_SNAPSHOT_HEADING}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      <p className="mt-3">
        <Link href={`/projects/${projectId}`} className="text-sm font-medium text-primary underline underline-offset-4">View current project →</Link>
      </p>
    </aside>
  )
}
