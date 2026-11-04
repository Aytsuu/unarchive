"use client"

import Link from "next/link"
import { useRef, useState, type ChangeEvent, type DragEvent } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { ProjectCredits } from "@/components/publish/project-credits"
import { PublishConsents } from "@/components/publish/publish-consents"
import { RepeatableFields, type RepeatableField } from "@/components/publish/repeatable-fields"

export function PublishForm() {
  const [step, setStep] = useState(1)
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const nextFieldId = useRef(0)
  const [links, setLinks] = useState<RepeatableField[]>([])
  const [photos, setPhotos] = useState<File[]>([])
  const [institution, setInstitution] = useState("")
  const [contributors, setContributors] = useState<RepeatableField[]>([])
  const [permission, setPermission] = useState(false)
  const [contributorsPermission, setContributorsPermission] = useState(false)
  const [status, setStatus] = useState("")

  function addContributor() {
    const id = nextFieldId.current++
    setContributors((current) => [...current, { id, value: "" }])
  }

  function nextStep() {
    setStatus("")
    if (step < 3) setStep((current) => current + 1)
    else if (!permission || !contributorsPermission) setStatus("Please confirm both consents before publishing.")
    else setStatus("Publishing is not available yet.")
  }

  function addLink() {
    const id = nextFieldId.current++
    setLinks((current) => [...current, { id, value: "" }])
  }

  function addPhotos(files: FileList | File[]) {
    const accepted = Array.from(files).filter((file) => ["image/png", "image/jpeg"].includes(file.type))
    setPhotos((current) => [...current, ...accepted])
    setStatus(accepted.length === files.length ? "" : "Only PNG and JPEG images are supported.")
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
      <header className="flex items-center justify-between gap-3 pt-[37px] sm:px-[10px]">
        <Link href="/home" aria-label="Back to home" className={buttonVariants({ variant: "secondary", size: "icon" })}>
          <span aria-hidden="true" className="relative block size-5">
            {/* Figma's undo icon has two separate vector layers. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/publish/undo-curve.svg" alt="" className="absolute left-[1.75px] top-[5.9px]" />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/publish/undo-arrow.svg" alt="" className="absolute left-[1.75px] top-[2.9px]" />
          </span>
        </Link>
        <div className="flex gap-2">
          <Button type="button" variant="secondary" className="w-[119px]" onClick={() => { setStatus(""); setStep((current) => Math.max(1, current - 1)) }} disabled={step === 1}>Previous</Button>
          <Button type="button" className="w-[119px]" onClick={nextStep}>
            {step < 3 ? "Next" : "Publish"}
          </Button>
        </div>
      </header>

      <section className="mx-auto mt-[27px] flex w-full max-w-[357px] flex-col items-center">
        <Progress value={step * 100 / 3} aria-label="Publish progress" aria-valuetext={`Step ${step} of 3`} className="mx-auto w-[220px] max-w-full [&_[data-slot=progress-track]]:h-2" />
        <p className="sr-only" aria-live="polite">Step {step} of 3</p>
        <h1 className="mt-[34px] text-center text-[26px] font-medium leading-[31px]">Share Your Work</h1>
        <p className="text-center text-xl font-medium leading-6">Unarchive your rotting capstone</p>

        {step === 1 ? (
          <div className="mt-[50px] w-full">
            <Input aria-label="Project title" placeholder="Add title" value={title} onChange={(event) => setTitle(event.target.value)}/>
            <Textarea aria-label="Short description" placeholder="Add short description" value={description} onChange={(event) => setDescription(event.target.value)} className="mt-[26px] h-[116px]" />
            <div className="mt-[34px] px-[5px]">
              <h2 className="text-lg font-medium">Links</h2>
              <p className="mt-[7px] text-base font-medium">Add relevant links of this project</p>
              <div className="mt-[14px]"><RepeatableFields kind="link" fields={links} onAdd={addLink} onChange={setLinks} /></div>
            </div>
            <div className="mt-[14px] px-[5px]">
              <h2 className="text-lg font-medium">Demos</h2>
              <p className="mt-[7px] text-base font-medium">Add relevant demo images of this project</p>
              <label onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="mt-[15px] flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-[20px] border border-border text-center focus-within:outline-2 focus-within:outline-ring">
                <input type="file" accept="image/png,image/jpeg" multiple className="sr-only" onChange={onPhotosChange} />
                <span className="text-base font-medium">Drop or upload a photo</span>
                <span className="text-sm text-muted-foreground">png, jpeg, jpg</span>
              </label>
              {photos.length > 0 && <ul className="mt-3 space-y-2 text-sm">{photos.map((photo, index) => <li key={`${photo.name}-${index}`} className="flex items-center justify-between gap-2 break-all"><span>{photo.name}</span><Button type="button" variant="ghost" size="xs" onClick={() => setPhotos((current) => current.filter((_, i) => i !== index))} aria-label={`Remove ${photo.name}`}>Remove</Button></li>)}</ul>}
            </div>
          </div>
        ) : step === 2 ? (
          <ProjectCredits institution={institution} onInstitutionChange={setInstitution} contributors={contributors} onAddContributor={addContributor} onContributorsChange={setContributors} />
        ) : (
          <PublishConsents permission={permission} contributorsPermission={contributorsPermission} onPermissionChange={setPermission} onContributorsPermissionChange={setContributorsPermission} />
        )}
        {status && <p role="status" className="mt-4 text-center text-sm text-muted-foreground">{status}</p>}
      </section>
    </main>
  )
}
