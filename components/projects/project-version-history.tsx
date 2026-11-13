"use client"

import Link from "next/link"
import { useState } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export type ProjectVersionSummary = { version: number; capturedAt: string; kind: "published" | "revision" | "legacy" }
type LoadedVersions = { projectId: string; versions: ProjectVersionSummary[]; nextBefore: number | null }

function readPage(payload: unknown): { versions: ProjectVersionSummary[]; nextBefore: number | null } {
  if (!payload || typeof payload !== "object" || !("data" in payload) || !payload.data || typeof payload.data !== "object") throw new Error("Could not load older versions.")
  const data = payload.data
  if (!("versions" in data) || !Array.isArray(data.versions) || !("nextBefore" in data) || !(data.nextBefore === null || (typeof data.nextBefore === "number" && Number.isSafeInteger(data.nextBefore) && data.nextBefore > 0))) throw new Error("Could not load older versions.")
  if (!data.versions.every((item: unknown) => item && typeof item === "object" && "version" in item && typeof item.version === "number" && Number.isSafeInteger(item.version) && item.version > 0 && "capturedAt" in item && typeof item.capturedAt === "string" && "kind" in item && ["published", "revision", "legacy"].includes(String(item.kind)))) throw new Error("Could not load older versions.")
  return { versions: data.versions as ProjectVersionSummary[], nextBefore: data.nextBefore }
}

export function ProjectVersionHistory({ projectId, versions, nextBefore, displayedVersion, latestVersion, canEdit }: {
  projectId: string; versions: ProjectVersionSummary[]; nextBefore: number | null; displayedVersion: number; latestVersion: number; canEdit: boolean
}) {
  const [loaded, setLoaded] = useState<LoadedVersions | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const extra = loaded?.projectId === projectId ? loaded : null
  const cursor = extra ? extra.nextBefore : nextBefore
  const items = [...new Map([...versions, ...(extra?.versions ?? [])].map((item) => [item.version, item])).values()].sort((a, b) => b.version - a.version)

  async function loadMore() {
    if (pending || cursor === null) return
    setPending(true)
    setError("")
    try {
      const response = await fetch(`/api/projects/${projectId}/versions?before=${cursor}`, { cache: "no-store" })
      if (!response.ok) throw new Error("Could not load older versions.")
      const page = readPage(await response.json())
      setLoaded({ projectId, versions: [...(extra?.versions ?? []), ...page.versions], nextBefore: page.nextBefore })
    } catch {
      setError("Could not load older versions. Please try again.")
    } finally { setPending(false) }
  }

  return <Card className="gap-2 rounded-[20px] border p-5 ring-0">
    <CardHeader className="gap-0 p-0"><CardTitle>Version history</CardTitle></CardHeader>
    <CardContent className="space-y-3 p-0 text-sm">
      <p className="text-muted-foreground">Viewing version {displayedVersion}{displayedVersion === latestVersion ? " (latest)" : ""}.</p>
      <ol className="space-y-2" aria-label="Project versions">{items.map((item) => {
        const date = new Date(item.capturedAt)
        const dateLabel = Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("en", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" }).format(date)
        return <li key={item.version} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <Link href={`/projects/${projectId}/versions/${item.version}`} aria-current={item.version === displayedVersion ? "page" : undefined} className="font-medium text-primary underline underline-offset-4">Version {item.version}</Link>
          <span className="text-xs text-muted-foreground">{item.kind === "legacy" ? "Legacy baseline" : item.kind === "published" ? "Published" : "Revision"}{dateLabel ? ` - ${dateLabel}` : ""}</span>
        </li>
      })}</ol>
      {cursor !== null && <Button type="button" variant="outline" size="sm" disabled={pending} onClick={loadMore}>{pending ? "Loading..." : "Load older versions"}</Button>}
      {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      {displayedVersion !== latestVersion && <p><Link href={`/projects/${projectId}`} className="text-primary underline underline-offset-4">View latest version</Link></p>}
      {canEdit && displayedVersion === latestVersion && <Link href={`/projects/${projectId}/edit`} className={buttonVariants({ variant: "secondary" })}>Edit project</Link>}
    </CardContent>
  </Card>
}
