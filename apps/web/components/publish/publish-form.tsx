"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { ProjectCredits } from "@/components/publish/project-credits"
import { PublishConsents } from "@/components/publish/publish-consents"
import { RepeatableFields, type RepeatableField } from "@/components/publish/repeatable-fields"
import { DemoUploader } from "@/components/publish/demo-uploader"
import { TopicsSelect } from "@/components/publish/topics-select"
import type { ReferenceProject } from "@/components/publish/reference-projects"
import { useInstitutions } from "@/components/institutions/institution-catalog"
import { matchInstitutionName } from "@/lib/institutions/match"

const ManuscriptReview = dynamic(() => import("@/components/publish/manuscript-review").then((module) => module.ManuscriptReview), { ssr: false })
type ManuscriptField = "title" | "description" | "abstract" | "institution" | "authors" | "year"

export function PublishForm() {
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [abstract, setAbstract] = useState("")
  const [topics, setTopics] = useState<string[]>([])
  const nextFieldId = useRef(0)
  const [links, setLinks] = useState<RepeatableField[]>([])
  const [photos, setPhotos] = useState<File[]>([])
  const [institution, setInstitution] = useState("")
  const [institutionMatchStatus, setInstitutionMatchStatus] = useState("")
  const { data: institutions, isError: institutionDirectoryError, refetch: retryInstitutions } = useInstitutions()
  const [dateEnded, setDateEnded] = useState("")
  const [contributors, setContributors] = useState<RepeatableField[]>([])
  const [referenceProjects, setReferenceProjects] = useState<ReferenceProject[]>([])
  const [publishRights, setPublishRights] = useState(false)
  const [contributorAccuracy, setContributorAccuracy] = useState(false)
  const [status, setStatus] = useState("")
  const [notice, setNotice] = useState("")
  const [manuscriptSession, setManuscriptSession] = useState(0)
  const [manuscriptSources, setManuscriptSources] = useState<ManuscriptField[]>([])
  const [sourceRequest, setSourceRequest] = useState<{ field: ManuscriptField; sequence: number }>()
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const submissionId = useRef<string | null>(null)
  const noticeRef = useRef<HTMLParagraphElement>(null)
  const missingRequired = (step === 1 && !title.trim()) || (step === 3 && (!publishRights || !contributorAccuracy))

  useEffect(() => {
    if (notice) noticeRef.current?.focus()
  }, [notice])

  function clearProject() {
    setStep(1)
    setTitle("")
    setDescription("")
    setAbstract("")
    setTopics([])
    setLinks([])
    setPhotos([])
    setInstitution("")
    setInstitutionMatchStatus("")
    setDateEnded("")
    setContributors([])
    setReferenceProjects([])
    setPublishRights(false)
    setContributorAccuracy(false)
    setStatus("")
    setManuscriptSession((current) => current + 1)
    setManuscriptSources([])
    submissionId.current = null
    setNotice("Submitted for moderation. It stays off the public site until a moderator approves it.")
  }

  function addContributor() {
    const id = nextFieldId.current++
    setContributors((current) => [...current, { id, value: "" }])
  }

  function applyManuscriptField(field: ManuscriptField, value: string) {
    if (field === "title") setTitle(value)
    if (field === "description") setDescription(value)
    if (field === "abstract") setAbstract(value)
    if (field === "institution") {
      if (!institutions) {
        if (institutionDirectoryError) {
          setInstitutionMatchStatus("The institution directory is unavailable. Retrying; please try applying the institution again.")
          void retryInstitutions()
        } else setInstitutionMatchStatus("The institution directory is loading. Please try applying the institution again in a moment.")
        return false
      }
      const matched = matchInstitutionName(value, institutions.map((item) => item.name))
      setInstitution(matched ?? value)
      setInstitutionMatchStatus(matched ? `Matched to ${matched}.` : "No unique directory match found. The extracted name was kept; please verify it in project credits.")
    }
    if (field === "year") {
      if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false
      setDateEnded(value)
    }
    if (field === "authors") {
      const names = value.split(/\n/).map((name) => name.trim()).filter(Boolean)
      if (contributors.some(({ value: current }) => current.trim()) && !window.confirm("Replace the authors and contributors already entered with these names?")) return false
      setContributors(names.map((name) => ({ id: nextFieldId.current++, value: name })))
    }
    setManuscriptSources((current) => current.includes(field) ? current : [...current, field])
    return true
  }

  function forgetManuscriptSource(field: ManuscriptField) {
    setManuscriptSources((current) => current.filter((item) => item !== field))
  }

  function showManuscriptSource(field: ManuscriptField) {
    setStep(1)
    setSourceRequest((current) => ({ field, sequence: (current?.sequence ?? 0) + 1 }))
    requestAnimationFrame(() => document.getElementById("manuscript-review")?.scrollIntoView({ behavior: "smooth", block: "start" }))
  }

  function validateDetails() {
    if (!title.trim()) return "Enter a project title."
    if (title.trim().length > 200) return "The project title must be at most 200 characters."
    if (description.trim().length > 5000) return "The description must be at most 5,000 characters."
    if (abstract.trim().length > 10000) return "The abstract must be at most 10,000 characters."
    const values = links.map(({ value }) => value.trim()).filter(Boolean)
    if (values.length > 20) return "Add no more than 20 links."
    if (values.some((value) => value.length > 2048)) return "Each link must be at most 2,048 characters."
    if (values.some((value) => {
      try {
        const url = new URL(value)
        return !["http:", "https:"].includes(url.protocol) || Boolean(url.username || url.password)
      } catch { return true }
    })) return "Enter valid HTTP or HTTPS links without credentials."
    return ""
  }

  function validateCredits() {
    if (institution.trim().length > 200) return "The institution must be at most 200 characters."
    if (dateEnded && !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(dateEnded)) return "Enter a valid completion month and year."
    const names = contributors.map(({ value }) => value.trim()).filter(Boolean)
    if (names.length > 50) return "Add no more than 50 contributors."
    if (names.some((name) => name.length > 200)) return "Each contributor's name must be at most 200 characters."
    return ""
  }

  async function nextStep() {
    if (pendingRef.current || missingRequired) return
    setStatus("")
    setNotice("")
    if (step === 1) {
      const error = validateDetails()
      if (error) return setStatus(error)
      return setStep(2)
    }
    if (step === 2) {
      const error = validateCredits()
      if (error) return setStatus(error)
      return setStep(3)
    }
    const detailsError = validateDetails()
    if (detailsError) { setStep(1); return setStatus(detailsError) }
    const creditsError = validateCredits()
    if (creditsError) { setStep(2); return setStatus(creditsError) }

    const body = new FormData()
    body.set("project", JSON.stringify({
      projectType: "thesis",
      title: title.trim(),
      description: description.trim(),
      abstract: abstract.trim(),
      topics,
      links: links.map(({ value }) => value.trim()).filter(Boolean),
      institution: institution.trim(),
      dateEnded,
      contributors: contributors.map(({ value }) => value.trim()).filter(Boolean),
      referenceProjectIds: referenceProjects.map((project) => project.id),
      consents: { permission: true, contributorsPermission: true, detailsAccurate: true, universityIp: true },
    }))
    for (const photo of photos) body.append("demos", photo)
    pendingRef.current = true
    setPending(true)
    let response: Response
    try {
      submissionId.current ??= crypto.randomUUID()
      response = await fetch("/api/projects", { method: "POST", body, headers: { "Idempotency-Key": submissionId.current } })
    } catch {
      setStatus("Unable to publish your project. Please check your connection and try again.")
      pendingRef.current = false
      setPending(false)
      return
    }
    if (!response.ok) {
      const payload: unknown = await response.json().catch(() => null)
      const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string" ? payload.error : "Unable to publish your project. Please try again."
      setStatus(response.status === 401 ? "Your session has expired. Please sign in and try again." : message)
      if (response.status === 409) submissionId.current = null
      pendingRef.current = false
      setPending(false)
      return
    }
    clearProject()
    pendingRef.current = false
    setPending(false)
  }

  function addLink() {
    const id = nextFieldId.current++
    setLinks((current) => [...current, { id, value: "" }])
  }

  function addPhotos(files: FileList | File[]) {
    const selected = Array.from(files)
    if (selected.some((file) => !["image/png", "image/jpeg"].includes(file.type))) return setStatus("Only PNG and JPEG images are supported.")
    if (selected.some((file) => file.size > 5 * 1024 * 1024)) return setStatus("Each image must be no larger than 5 MB.")
    if (photos.length + selected.length > 5) return setStatus("Add no more than 5 demo images.")
    setPhotos((current) => [...current, ...selected])
    setStatus("")
  }

  function onPhotosChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addPhotos(event.target.files)
    event.target.value = ""
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    addPhotos(event.dataTransfer.files)
  }

  return (
    <main className="min-h-dvh bg-background px-5 pb-20 text-foreground">
      <header className="flex items-center justify-between gap-3 pt-9.25 sm:px-2.5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-5.25">
        <Link href="/home" aria-label="Back to home" aria-disabled={pending} onClick={(event) => { if (pending) event.preventDefault() }} className={buttonVariants({ variant: "secondary", size: "icon", className: pending ? "pointer-events-none opacity-50" : "" })}>
          <span aria-hidden="true" className="relative block size-5">
            {/* Figma's undo icon has two separate vector layers. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/publish/undo-curve.svg" alt="" className="absolute left-[1.75px] top-[5.9px]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/publish/undo-arrow.svg" alt="" className="absolute left-[1.75px] top-[2.9px]" />
          </span>
        </Link>
        <span className="text-xl font-medium">Publish</span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="sm:w-29.75" onClick={() => { setStatus(""); setStep((current) => Math.max(1, current - 1)) }} disabled={step === 1 || pending}>Previous</Button>
          <Button type="button" className="sm:w-29.75" onClick={nextStep} disabled={pending || missingRequired}>
            {pending ? "Publishing..." : step < 3 ? "Next" : "Publish"}
          </Button>
        </div>
      </header>

      <div hidden={step !== 1} className="mx-auto mt-8 max-w-7xl">
        <ManuscriptReview key={manuscriptSession} onApply={applyManuscriptField} sourceRequest={sourceRequest} onSourcesReset={() => { setManuscriptSources([]); setInstitutionMatchStatus("") }} />
        {institutionMatchStatus && <p role="status" className="mt-2 text-sm text-muted-foreground">{institutionMatchStatus}</p>}
      </div>

      <section className="mx-auto mt-12.75 flex w-full max-w-89.25 flex-col items-center" aria-busy={pending}>
        <Progress value={step * 100 / 3} aria-label="Publish progress" aria-valuetext={`Step ${step} of 3`} className="mx-auto w-55 max-w-full **:data-[slot=progress-track]:h-2" />
        <p className="sr-only" aria-live="polite">Step {step} of 3</p>
        <h1 className="mt-8.5 text-center text-[26px] font-medium leading-7.75">Share Your Work</h1>
        <p className="text-center text-xl font-medium leading-6">Unarchive your rotting capstone</p>
        {status && <p role="alert" className="mt-4 text-center text-sm text-destructive">{status}</p>}
        {notice && <p ref={noticeRef} tabIndex={-1} role="status" className="mt-4 text-center text-sm outline-none">{notice}</p>}
        {pending && <p role="status" className="mt-4 text-center text-sm text-muted-foreground">Publishing your project...</p>}

        {step === 1 ? (
          <div className="mt-12.5 w-full">
            <Input aria-label="Project title" placeholder="Add title" required maxLength={200} value={title} onChange={(event) => { setTitle(event.target.value); forgetManuscriptSource("title") }}/>
            {manuscriptSources.includes("title") && <button type="button" className="mt-1 text-sm underline" onClick={() => showManuscriptSource("title")}>View title source</button>}
            <Textarea aria-label="Short description" placeholder="Add short description" maxLength={5000} value={description} onChange={(event) => { setDescription(event.target.value); forgetManuscriptSource("description") }} className="mt-6.5 h-20" />
            {manuscriptSources.includes("description") && <button type="button" className="mt-1 text-sm underline" onClick={() => showManuscriptSource("description")}>View description source</button>}
            <Textarea aria-label="Abstract" placeholder="Add abstract" maxLength={10000} value={abstract} onChange={(event) => { setAbstract(event.target.value); forgetManuscriptSource("abstract") }} className="mt-6.5 h-29" />
            {manuscriptSources.includes("abstract") && <button type="button" className="mt-1 text-sm underline" onClick={() => showManuscriptSource("abstract")}>View abstract source</button>}
            <div className="mt-8.5 px-1.25">
              <h2 className="text-lg font-medium">Topics</h2>
              <div className="mt-3.5"><TopicsSelect value={topics} onChange={setTopics} /></div>
            </div>
            <div className="mt-8.5 px-1.25">
              <h2 className="text-lg font-medium">Links</h2>
              <p className="mt-1.75 text-base font-medium">Add relevant links of this project</p>
              <div className="mt-3.5"><RepeatableFields kind="link" fields={links} onAdd={addLink} onChange={setLinks} /></div>
            </div>
            <div className="mt-3.5 px-1.25">
              <h2 className="text-lg font-medium">Demos</h2>
              <p className="mt-1.75 text-base font-medium">Add relevant demo images of this project</p>
              <DemoUploader photos={photos} onPhotosChange={onPhotosChange} onDrop={onDrop} onRemove={(index) => setPhotos((current) => current.filter((_, i) => i !== index))} />
            </div>
          </div>
        ) : step === 2 ? (
          <><ProjectCredits institution={institution} onInstitutionChange={(value) => { setInstitution(value); setInstitutionMatchStatus(""); forgetManuscriptSource("institution") }} dateEnded={dateEnded} onDateEndedChange={(value) => { setDateEnded(value); forgetManuscriptSource("year") }} contributors={contributors} onAddContributor={() => { addContributor(); forgetManuscriptSource("authors") }} onContributorsChange={(value) => { setContributors(value); forgetManuscriptSource("authors") }} referenceProjects={referenceProjects} onReferenceProjectsChange={setReferenceProjects} />
          {manuscriptSources.includes("year") && <button type="button" className="mt-4 self-start text-sm underline" onClick={() => showManuscriptSource("year")}>View completion year source</button>}
          {manuscriptSources.includes("institution") && <button type="button" className="mt-4 self-start text-sm underline" onClick={() => showManuscriptSource("institution")}>View institution source</button>}
          {manuscriptSources.includes("authors") && <button type="button" className="mt-2 self-start text-sm underline" onClick={() => showManuscriptSource("authors")}>View authors source</button>}</>
        ) : (
          <PublishConsents publishRights={publishRights} contributorAccuracy={contributorAccuracy} onPublishRightsChange={setPublishRights} onContributorAccuracyChange={setContributorAccuracy} disabled={pending} />
        )}
      </section>
    </main>
  )
}
