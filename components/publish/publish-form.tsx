"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, type ChangeEvent, type DragEvent } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { ProjectCredits } from "@/components/publish/project-credits"
import { PublishConsents } from "@/components/publish/publish-consents"
import { RepeatableFields, type RepeatableField } from "@/components/publish/repeatable-fields"

export function PublishForm() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [abstract, setAbstract] = useState("")
  const nextFieldId = useRef(0)
  const [links, setLinks] = useState<RepeatableField[]>([])
  const [photos, setPhotos] = useState<File[]>([])
  const [institution, setInstitution] = useState("")
  const [dateStarted, setDateStarted] = useState("")
  const [dateEnded, setDateEnded] = useState("")
  const [contributors, setContributors] = useState<RepeatableField[]>([])
  const [permission, setPermission] = useState(false)
  const [contributorsPermission, setContributorsPermission] = useState(false)
  const [status, setStatus] = useState("")
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const submissionId = useRef<string | null>(null)
  const missingRequired = (step === 1 && !title.trim()) || (step === 3 && (!permission || !contributorsPermission))

  function addContributor() {
    const id = nextFieldId.current++
    setContributors((current) => [...current, { id, value: "" }])
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
    if ([dateStarted, dateEnded].some((value) => value && !/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value))) return "Enter a valid month and year."
    if (dateStarted && dateEnded && dateEnded < dateStarted) return "Date ended must be the same as or later than date started."
    const names = contributors.map(({ value }) => value.trim()).filter(Boolean)
    if (names.length > 50) return "Add no more than 50 contributors."
    if (names.some((name) => name.length > 200)) return "Each contributor's name must be at most 200 characters."
    return ""
  }

  async function nextStep() {
    if (pendingRef.current || missingRequired) return
    setStatus("")
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
      title: title.trim(),
      description: description.trim(),
      abstract: abstract.trim(),
      links: links.map(({ value }) => value.trim()).filter(Boolean),
      institution: institution.trim(),
      dateStarted,
      dateEnded,
      contributors: contributors.map(({ value }) => value.trim()).filter(Boolean),
      consents: { permission, contributorsPermission },
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
    router.replace("/home")
    router.refresh()
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

  function onDrop(event: DragEvent<HTMLLabelElement>) {
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

      <section className="mx-auto mt-6.75 flex w-full max-w-89.25 flex-col items-center" aria-busy={pending}>
        <Progress value={step * 100 / 3} aria-label="Publish progress" aria-valuetext={`Step ${step} of 3`} className="mx-auto w-55 max-w-full **:data-[slot=progress-track]:h-2" />
        <p className="sr-only" aria-live="polite">Step {step} of 3</p>
        <h1 className="mt-8.5 text-center text-[26px] font-medium leading-7.75">Share Your Work</h1>
        <p className="text-center text-xl font-medium leading-6">Unarchive your rotting capstone</p>
        {status && <p role="alert" className="mt-4 text-center text-sm text-destructive">{status}</p>}
        {pending && <p role="status" className="mt-4 text-center text-sm text-muted-foreground">Publishing your project...</p>}

        {step === 1 ? (
          <div className="mt-12.5 w-full">
            <Input aria-label="Project title" placeholder="Add title" required maxLength={200} value={title} onChange={(event) => setTitle(event.target.value)}/>
            <Textarea aria-label="Short description" placeholder="Add short description" maxLength={5000} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-6.5 h-29" />
            <Textarea aria-label="Abstract" placeholder="Add abstract" maxLength={10000} value={abstract} onChange={(event) => setAbstract(event.target.value)} className="mt-6.5 h-29" />
            <div className="mt-8.5 px-1.25">
              <h2 className="text-lg font-medium">Links</h2>
              <p className="mt-1.75 text-base font-medium">Add relevant links of this project</p>
              <div className="mt-3.5"><RepeatableFields kind="link" fields={links} onAdd={addLink} onChange={setLinks} /></div>
            </div>
            <div className="mt-3.5 px-1.25">
              <h2 className="text-lg font-medium">Demos</h2>
              <p className="mt-1.75 text-base font-medium">Add relevant demo images of this project</p>
              <label onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="mt-3.75 flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border border-border text-center focus-within:outline-2 focus-within:outline-ring">
                <input type="file" accept="image/png,image/jpeg" multiple className="sr-only" onChange={onPhotosChange} />
                <span className="text-base font-medium">Drop or upload a photo</span>
                <span className="text-sm text-muted-foreground">png, jpeg, jpg</span>
              </label>
              {photos.length > 0 && <ul className="mt-3 space-y-2 text-sm">{photos.map((photo, index) => <li key={`${photo.name}-${index}`} className="flex items-center justify-between gap-2 break-all"><span>{photo.name}</span><Button type="button" variant="ghost" size="xs" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))} aria-label={`Remove ${photo.name}`}>Remove</Button></li>)}</ul>}
            </div>
          </div>
        ) : step === 2 ? (
          <ProjectCredits institution={institution} onInstitutionChange={setInstitution} dateStarted={dateStarted} dateEnded={dateEnded} onDateStartedChange={setDateStarted} onDateEndedChange={setDateEnded} contributors={contributors} onAddContributor={addContributor} onContributorsChange={setContributors} />
        ) : (
          <PublishConsents permission={permission} contributorsPermission={contributorsPermission} onPermissionChange={setPermission} onContributorsPermissionChange={setContributorsPermission} disabled={pending} />
        )}
      </section>
    </main>
  )
}
