"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { BrandLogo } from "@/components/brand/brand-logo"
import { Button } from "@/components/ui/button"

type Report = { id: string; category: string; details: string; projectId: string | null; status: string; createdAt: string }

export function AdminReports() {
  const [reports, setReports] = useState<Report[]>([])
  const [error, setError] = useState("")
  const [pendingId, setPendingId] = useState("")

  async function load() {
    setError("")
    try {
      const response = await fetch("/api/admin/reports", { cache: "no-store" })
      const payload: unknown = await response.json().catch(() => null)
      if (!response.ok || typeof payload !== "object" || payload === null || !("data" in payload)) {
        setError("Unable to load reports.")
        return
      }
      const data = payload.data as { reports?: Report[] }
      setReports(Array.isArray(data.reports) ? data.reports : [])
    } catch {
      setError("Unable to load reports.")
    }
  }

  useEffect(() => { void load() }, [])

  async function update(id: string, body: Record<string, unknown>) {
    setPendingId(id)
    setError("")
    try {
      const response = await fetch(`/api/admin/reports/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
      if (!response.ok) {
        setError("Unable to update this report.")
        return
      }
      await load()
    } catch {
      setError("Unable to update this report.")
    } finally {
      setPendingId("")
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 px-5 pt-6 sm:px-10">
        <Link href="/home" className="text-xl font-medium"><BrandLogo /></Link>
        <Link href="/home" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
        <h1 className="text-2xl font-medium">Content reports</h1>
        {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
        <ul className="mt-8 space-y-4">
          {reports.length === 0 && !error ? <li className="text-sm text-muted-foreground">No reports yet.</li> : reports.map((report) => (
            <li key={report.id} className="rounded-xl border border-border p-4">
              <p className="text-sm font-medium">{report.category} · {report.status}</p>
              {report.projectId && <p className="mt-1 text-sm"><Link href={`/projects/${report.projectId}`} className="underline underline-offset-4">Project {report.projectId}</Link></p>}
              <p className="mt-2 text-sm leading-6 wrap-break-word">{report.details}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="secondary" size="sm" disabled={pendingId === report.id} onClick={() => update(report.id, { status: "reviewing" })}>Reviewing</Button>
                <Button type="button" variant="secondary" size="sm" disabled={pendingId === report.id || !report.projectId} onClick={() => update(report.id, { status: "resolved", restrictProject: true, resolution: "restricted" })}>Restrict project</Button>
                <Button type="button" variant="secondary" size="sm" disabled={pendingId === report.id} onClick={() => update(report.id, { status: "resolved" })}>Resolve</Button>
                <Button type="button" variant="secondary" size="sm" disabled={pendingId === report.id} onClick={() => update(report.id, { status: "rejected" })}>Reject</Button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
