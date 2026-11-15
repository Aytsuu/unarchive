"use client"

import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { REPORT_CATEGORIES } from "@/lib/legal/reports"

const labels: Record<(typeof REPORT_CATEGORIES)[number], string> = {
  copyright: "Copyright infringement",
  authorship: "Incorrect authorship",
  contributor: "Unauthorized contributor information",
  confidential: "Confidential project materials",
  privacy: "Privacy or data correction request",
  policy: "General policy violation",
}

export function ContentReportForm({ signedIn }: { signedIn: boolean }) {
  const [category, setCategory] = useState<(typeof REPORT_CATEGORIES)[number]>("copyright")
  const [details, setDetails] = useState("")
  const [projectId, setProjectId] = useState("")
  const [contactEmail, setContactEmail] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [status, setStatus] = useState("")

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setStatus("")
    setPending(true)
    try {
      const response = await fetch("/api/reports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          details,
          ...(projectId.trim() ? { projectId: projectId.trim() } : {}),
          ...(!signedIn && contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
        }),
      })
      const payload: unknown = await response.json().catch(() => null)
      const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "Unable to send your request. Please try again."
      if (!response.ok) {
        setError(message)
        return
      }
      setDetails("")
      setProjectId("")
      setContactEmail("")
      setStatus("Your request was received. We will review it as soon as possible.")
    } catch {
      setError("Unable to send your request right now. Please try again.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="report-category">Category</Label>
        <select id="report-category" value={category} onChange={(event) => setCategory(event.target.value as (typeof REPORT_CATEGORIES)[number])} className="h-9 w-full rounded-lg border border-input bg-background px-3 text-sm">
          {REPORT_CATEGORIES.map((value) => <option key={value} value={value}>{labels[value]}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="report-project">Project ID (optional)</Label>
        <Input id="report-project" value={projectId} onChange={(event) => setProjectId(event.target.value)} maxLength={24} placeholder="From the project page URL" />
      </div>
      {!signedIn && (
        <div className="space-y-2">
          <Label htmlFor="report-email">Email</Label>
          <Input id="report-email" type="email" required value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} maxLength={254} autoComplete="email" />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="report-details">Details</Label>
        <Textarea id="report-details" required value={details} onChange={(event) => setDetails(event.target.value)} maxLength={5000} className="min-h-32" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {status && <p role="status" className="text-sm text-muted-foreground">{status}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Sending…" : "Submit request"}</Button>
    </form>
  )
}
