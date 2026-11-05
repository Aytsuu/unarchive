"use client"

import { StarIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useRef, useState } from "react"

export type ProjectMetricsValue = { views: number; stars: number; starred: boolean }

export function ProjectMetrics({ projectId, initial }: { projectId: string; initial: ProjectMetricsValue }) {
  const [metrics, setMetrics] = useState(initial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const pendingRef = useRef(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/projects/${projectId}/views`, {
      method: "POST", signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) throw new Error("View count unavailable")
      const result = await response.json()
      if (!controller.signal.aborted && typeof result.data?.views === "number") setMetrics((current) => ({ ...current, views: result.data.views }))
    }).catch(() => { if (!controller.signal.aborted) console.warn("Project view could not be recorded") })
    return () => controller.abort()
  }, [projectId])

  async function toggleStar() {
    if (pendingRef.current) return
    pendingRef.current = true
    setPending(true)
    setError("")
    try {
      const response = await fetch(`/api/projects/${projectId}/stars`, { method: metrics.starred ? "DELETE" : "PUT" })
      if (!response.ok) throw new Error("Unable to update your star. Please try again.")
      const result = await response.json()
      if (typeof result.data?.stars !== "number" || typeof result.data?.starred !== "boolean") throw new Error("Unable to update your star. Please try again.")
      setMetrics((current) => ({ ...current, stars: result.data.stars, starred: result.data.starred }))
    } catch {
      setError("Unable to update your star. Please try again.")
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3.25">
        <span className="inline-flex h-7 min-w-14.75 items-center justify-center gap-1.5 rounded-full border border-border px-2 text-sm" aria-label={`${metrics.views} ${metrics.views === 1 ? "view" : "views"}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/projects/views.svg" alt="" />
          <span aria-hidden="true">{metrics.views}</span>
        </span>
        <button type="button" aria-label={metrics.starred ? "Remove star from project" : "Star project"} aria-pressed={metrics.starred} disabled={pending} onClick={toggleStar} className="inline-flex h-7 min-w-14.75 items-center justify-center gap-1.5 rounded-full border border-border px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-60">
          {metrics.starred ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/projects/star-filled.svg" alt="" />
          ) : <HugeiconsIcon icon={StarIcon} size={15} strokeWidth={1.8} className="text-[color-mix(in_oklab,var(--border)_75%,var(--foreground))]" aria-hidden="true" />}
          <span aria-hidden="true">{metrics.stars}</span><span className="sr-only" aria-live="polite">{metrics.stars} {metrics.stars === 1 ? "star" : "stars"}</span>
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  )
}
