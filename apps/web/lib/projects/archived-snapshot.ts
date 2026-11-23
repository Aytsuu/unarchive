export const ARCHIVED_SNAPSHOT_HEADING = "You're viewing an archived snapshot"

export function archivedSnapshotDescription(publishedAt: Date): string | null {
  if (!(publishedAt instanceof Date) || Number.isNaN(publishedAt.getTime())) return null
  const date = new Intl.DateTimeFormat("en", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(publishedAt)
  return `This is a preserved version of the project as published on ${date}. Its content may differ from the latest version.`
}
