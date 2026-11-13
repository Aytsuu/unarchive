"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useRef, useState, type FormEvent } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { ProjectCredits } from "@/components/publish/project-credits"
import { RepeatableFields, type RepeatableField } from "@/components/publish/repeatable-fields"
import { TopicsSelect } from "@/components/publish/topics-select"
import type { ReferenceProject } from "@/components/publish/reference-projects"
import { prepareProjectEdit } from "@/lib/projects/edit-draft"
import { ProjectWithdraw } from "@/components/projects/project-withdraw"

export type ProjectEditInitial = {
  id: string; currentVersion: number; title: string; description: string; abstract: string;
  institution: string; dateStarted: string; dateEnded: string; projectType: string;
  topics: string[]; links: string[]; contributors: string[]; references: ReferenceProject[];
  unavailableReferenceIds: string[]
}

export function ProjectEditForm({ initial }: { initial: ProjectEditInitial }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [abstract, setAbstract] = useState(initial.abstract)
  const [institution, setInstitution] = useState(initial.institution)
  const [dateStarted, setDateStarted] = useState(initial.dateStarted)
  const [dateEnded, setDateEnded] = useState(initial.dateEnded)
  const [topics, setTopics] = useState(initial.topics)
  const [links, setLinks] = useState<RepeatableField[]>(initial.links.map((value, id) => ({ id, value })))
  const [contributors, setContributors] = useState<RepeatableField[]>(initial.contributors.map((value, id) => ({ id, value })))
  const [references, setReferences] = useState<ReferenceProject[]>(initial.references)
  const [typeConfirmed, setTypeConfirmed] = useState(initial.projectType === "thesis")
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")
  const pendingRef = useRef(false)
  const submission = useRef<{ fingerprint: string; key: string } | null>(null)
  const nextId = useRef(Math.max(initial.links.length, initial.contributors.length))
  const unavailable = references.filter((item) => initial.unavailableReferenceIds.includes(item.id))

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRef.current || saved || !typeConfirmed || !title.trim() || unavailable.length) return
    const project = prepareProjectEdit({ title, description, abstract, institution, dateStarted, dateEnded, topics, links, contributors, references })
    const body = { expectedVersion: initial.currentVersion, project }
    const fingerprint = JSON.stringify(body)
    if (!globalThis.crypto?.randomUUID) { setError("A secure connection is required to save changes."); return }
    if (submission.current?.fingerprint !== fingerprint) submission.current = { fingerprint, key: crypto.randomUUID() }
    setError("")
    pendingRef.current = true
    setPending(true)
    try {
      const response = await fetch(`/api/projects/${initial.id}`, { method: "PUT", headers: { "Content-Type": "application/json", "Idempotency-Key": submission.current.key }, body: fingerprint })
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null)
        if (response.status === 409) throw new Error("This project changed since you opened it. Your edits have not been saved; reload the latest version before trying again.")
        const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string" ? payload.error : "Unable to save changes. Please try again."
        throw new Error(message)
      }
      setSaved(true)
      const payload: unknown = await response.json().catch(() => null)
      const version = payload && typeof payload === "object" && "data" in payload && payload.data && typeof payload.data === "object" && "version" in payload.data ? payload.data.version : null
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["project-list"] }), queryClient.invalidateQueries({ queryKey: ["project-statistics"] })])
      const destination = typeof version === "number" && Number.isSafeInteger(version) && version > 0 ? `/projects/${initial.id}/versions/${version}` : `/projects/${initial.id}`
      router.replace(destination)
      router.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to save changes. Please try again.")
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return <main className="min-h-dvh bg-background px-5 pb-20 text-foreground">
    <header className="mx-auto flex max-w-180 items-center justify-between gap-4 pt-9">
      <div><Link href={`/projects/${initial.id}`} className={buttonVariants({ variant: "secondary", size: "sm" })}>Back to project</Link><h1 className="mt-5 text-2xl font-medium">Edit project</h1></div>
      <ProjectWithdraw projectId={initial.id} disabled={pending || saved} />
    </header>
    <form onSubmit={save} className="mx-auto mt-8 max-w-180 space-y-6">
      <p className="text-sm text-muted-foreground">Saving creates a new version. Earlier versions and their demos remain available.</p>
      {error && <div role="alert" className="text-sm text-destructive"><p>{error}</p>{error.startsWith("This project changed") && <a href={`/projects/${initial.id}/edit`} className="underline underline-offset-4">Reload the latest version</a>}</div>}
      {saved && <p role="status" className="text-sm text-muted-foreground">Project saved. Opening the new version...</p>}
      <fieldset disabled={pending || saved} className="space-y-6">
        {!typeConfirmed && <div className="flex items-start gap-3"><Checkbox id="confirm-thesis-type" checked={typeConfirmed} onCheckedChange={setTypeConfirmed} /><Label htmlFor="confirm-thesis-type" className="leading-5">I confirm this project is a thesis.</Label></div>}
        <div className="space-y-2"><Label htmlFor="edit-title">Title</Label><Input id="edit-title" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="edit-description">Short description</Label><Textarea id="edit-description" maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="edit-abstract">Abstract</Label><Textarea id="edit-abstract" maxLength={10000} value={abstract} onChange={(event) => setAbstract(event.target.value)} /></div>
        <div className="space-y-2"><h2 className="text-sm font-medium">Topics</h2><TopicsSelect value={topics} onChange={setTopics} /></div>
        <div className="space-y-2"><h2 className="text-sm font-medium">Links</h2><RepeatableFields kind="link" fields={links} onChange={setLinks} onAdd={() => setLinks((current) => [...current, { id: nextId.current++, value: "" }])} /></div>
        <ProjectCredits institution={institution} onInstitutionChange={setInstitution} dateStarted={dateStarted} dateEnded={dateEnded} onDateStartedChange={setDateStarted} onDateEndedChange={setDateEnded} contributors={contributors} onAddContributor={() => setContributors((current) => [...current, { id: nextId.current++, value: "" }])} onContributorsChange={setContributors} referenceProjects={references} onReferenceProjectsChange={setReferences} />
        {unavailable.length > 0 && <p role="alert" className="text-sm text-destructive">Some referenced projects are unavailable. Remove the unavailable references before saving.</p>}
        <div className="flex flex-wrap items-center gap-3"><Button type="submit" disabled={!title.trim() || !typeConfirmed || unavailable.length > 0}>{pending ? "Saving..." : "Save new version"}</Button><Link href={`/projects/${initial.id}`} className={buttonVariants({ variant: "secondary" })}>Cancel</Link></div>
      </fieldset>
    </form>
  </main>
}
