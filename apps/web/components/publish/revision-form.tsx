"use client"

import Link from "next/link"
import { useRef, useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TopicsSelect } from "@/components/publish/topics-select"
import { ProjectCredits } from "@/components/publish/project-credits"
import { RepeatableFields, type RepeatableField } from "@/components/publish/repeatable-fields"
import type { ReferenceProject } from "@/components/publish/reference-projects"

export type RevisionInitial = {
  id: string; title: string; description: string; abstract: string; institution: string
  dateStarted: string; dateEnded: string; topics: string[]; links: string[]; contributors: string[]
  references: ReferenceProject[]; unavailableIds: string[]; demoCount: number; reason: string; resubmitted: boolean
}

export function RevisionForm({ initial }: { initial: RevisionInitial }) {
  const [title, setTitle] = useState(initial.title)
  const [description, setDescription] = useState(initial.description)
  const [abstract, setAbstract] = useState(initial.abstract)
  const [institution, setInstitution] = useState(initial.institution)
  const dateStarted = initial.dateStarted
  const [dateEnded, setDateEnded] = useState(initial.dateEnded)
  const [topics, setTopics] = useState(initial.topics)
  const [links, setLinks] = useState<RepeatableField[]>(initial.links.map((value, id) => ({ id, value })))
  const [contributors, setContributors] = useState<RepeatableField[]>(initial.contributors.map((value, id) => ({ id, value })))
  const [references, setReferences] = useState(initial.references)
  const [retained, setRetained] = useState(Array.from({ length: initial.demoCount }, (_, index) => index))
  const [files, setFiles] = useState<File[]>([])
  const [confirmed, setConfirmed] = useState(false)
  const [pending, setPending] = useState(false)
  const [done, setDone] = useState(initial.resubmitted)
  const [error, setError] = useState("")
  const nextId = useRef(Math.max(links.length, contributors.length))
  const inFlight = useRef(false)
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null)
  const unavailable = references.some((ref) => initial.unavailableIds.includes(ref.id))

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (inFlight.current || done || !confirmed || unavailable) return
    if (retained.length + files.length > 5) { setError("Choose up to five demo images."); return }
    const project = {
      projectType: "thesis", title, description, abstract, institution, dateStarted, dateEnded, topics,
      links: links.map((field) => field.value.trim()).filter(Boolean),
      contributors: contributors.map((field) => field.value.trim()).filter(Boolean),
      referenceProjectIds: references.map((ref) => ref.id),
      consents: { permission: true, contributorsPermission: true, detailsAccurate: true, universityIp: true },
    }
    const fingerprint = JSON.stringify([project, retained, files.map((file) => [file.name, file.size, file.lastModified, file.type])])
    if (!globalThis.crypto?.randomUUID) { setError("A secure connection is required to submit."); return }
    if (attempt.current?.fingerprint !== fingerprint) attempt.current = { fingerprint, key: crypto.randomUUID() }
    const form = new FormData()
    form.set("project", JSON.stringify(project))
    form.set("retained", JSON.stringify(retained))
    for (const file of files) form.append("demos", file)
    inFlight.current = true
    setPending(true)
    setError("")
    try {
      const response = await fetch(`/api/submissions/${initial.id}/resubmit`, { method: "POST", headers: { "Idempotency-Key": attempt.current.key }, body: form })
      const result: unknown = await response.json().catch(() => null)
      if (!response.ok) throw new Error(result && typeof result === "object" && "error" in result && typeof result.error === "string" ? result.error : "Unable to resubmit. Please try again.")
      setDone(true)
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to resubmit. Please try again.") }
    finally { inFlight.current = false; setPending(false) }
  }

  return <main className="mx-auto max-w-3xl px-6 py-12">
    <Link href="/home" className="text-sm underline">Back to home</Link>
    <h1 className="mt-6 text-3xl font-semibold">Revise your submission</h1>
    <section className="mt-6 rounded-xl border p-5" aria-labelledby="revision-reason">
      <h2 id="revision-reason" className="font-medium">Moderator feedback</h2>
      <p className="mt-2 whitespace-pre-wrap text-sm">{initial.reason}</p>
    </section>
    {done ? <p className="mt-6" role="status">Your revision has been submitted for review.</p> : <form onSubmit={submit} className="mt-8 space-y-6">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <fieldset disabled={pending} className="space-y-6">
        <div className="space-y-2"><Label htmlFor="revision-title">Title</Label><Input id="revision-title" required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="revision-description">Short description</Label><Textarea id="revision-description" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="revision-abstract">Abstract</Label><Textarea id="revision-abstract" maxLength={10000} value={abstract} onChange={(e) => setAbstract(e.target.value)} /></div>
        <div className="space-y-2"><h2 className="font-medium">Topics</h2><TopicsSelect value={topics} onChange={setTopics} /></div>
        <div className="space-y-2"><h2 className="font-medium">Links</h2><RepeatableFields kind="link" fields={links} onChange={setLinks} onAdd={() => setLinks((current) => [...current, { id: nextId.current++, value: "" }])} /></div>
        <ProjectCredits institution={institution} onInstitutionChange={setInstitution} dateEnded={dateEnded} minDateEnded={dateStarted} onDateEndedChange={setDateEnded} contributors={contributors} onAddContributor={() => setContributors((current) => [...current, { id: nextId.current++, value: "" }])} onContributorsChange={setContributors} referenceProjects={references} onReferenceProjectsChange={setReferences} />
        {unavailable && <p role="alert" className="text-sm text-destructive">Remove unavailable reference projects before resubmitting.</p>}
        <section className="space-y-3"><h2 className="font-medium">Demo images</h2>
          {retained.map((index) => <div key={index} className="flex items-center gap-3"><img src={`/api/submissions/${initial.id}/demos/${index}`} alt={`Submitted demo ${index + 1}`} className="size-20 rounded object-cover" /><Button type="button" variant="outline" onClick={() => setRetained((current) => current.filter((value) => value !== index))}>Remove image {index + 1}</Button></div>)}
          <Label htmlFor="revision-demos">Add PNG or JPEG images (maximum five total)</Label><Input id="revision-demos" type="file" accept="image/png,image/jpeg" multiple onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); attempt.current = null }} />
        </section>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} required />I confirm I have permission to publish, have contributor permission, the details are accurate, and the project respects university intellectual property.</label>
        <Button type="submit" disabled={!confirmed || unavailable || !title.trim()}>{pending ? "Submitting..." : "Resubmit for review"}</Button>
      </fieldset>
    </form>}
  </main>
}
