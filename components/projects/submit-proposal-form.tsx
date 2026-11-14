"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react"
import { Button, buttonVariants } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { DemoUploader } from "@/components/publish/demo-uploader"

export function SubmitProposalForm({ projectId, title }: { projectId: string; title: string }) {
  const router = useRouter()
  const [message, setMessage] = useState("")
  const [photos, setPhotos] = useState<File[]>([])
  const [status, setStatus] = useState("")
  const [pending, setPending] = useState(false)
  const pendingRef = useRef(false)
  const missingRequired = !message.trim()

  function addPhotos(list: FileList) {
    const next = [...photos]
    for (const file of list) {
      if (next.length >= 5) break
      if (!["image/png", "image/jpeg"].includes(file.type) || file.size > 5 * 1024 * 1024) continue
      next.push(file)
    }
    setPhotos(next)
  }

  function onPhotosChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) addPhotos(event.target.files)
    event.target.value = ""
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    addPhotos(event.dataTransfer.files)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pendingRef.current || missingRequired) return
    pendingRef.current = true
    setPending(true)
    setStatus("")
    try {
      const payload = new FormData()
      payload.set("message", message)
      for (const photo of photos) payload.append("attachments", photo)
      const response = await fetch(`/api/projects/${projectId}/proposals`, { method: "POST", body: payload })
      const result = await response.json().catch(() => null)
      if (!response.ok || !result?.success) {
        setStatus(typeof result?.error === "string" ? result.error : "Unable to submit your proposal. Please try again.")
        return
      }
      router.replace(`/projects/${projectId}`)
      router.refresh()
    } catch {
      setStatus("Unable to submit your proposal. Please try again.")
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return (
    <main className="min-h-dvh bg-background pb-20 text-foreground">
      <header className="flex items-center justify-between gap-3 px-5 pt-9.25 sm:pl-10 sm:pr-8.5">
        <div className="flex min-w-0 items-center gap-5.25">
          <Link href={`/projects/${projectId}`} aria-label="Back to project" aria-disabled={pending} onClick={(event) => { if (pending) event.preventDefault() }} className={buttonVariants({ variant: "secondary", size: "icon", className: pending ? "pointer-events-none opacity-50" : "" })}>
            <span aria-hidden="true" className="relative block size-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/publish/undo-curve.svg" alt="" className="absolute left-[1.75px] top-[5.9px]" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/publish/undo-arrow.svg" alt="" className="absolute left-[1.75px] top-[2.9px]" />
            </span>
          </Link>
          <span className="text-xl font-medium">Proposal</span>
        </div>
        <Button type="submit" form="proposal-form" className="w-[119px]" disabled={pending || missingRequired}>{pending ? "Submitting..." : "Submit"}</Button>
      </header>

      <form id="proposal-form" onSubmit={onSubmit} aria-busy={pending} className="mx-auto mt-4.5 w-full max-w-[809px] px-5">
        <h1 className="text-center text-[26px] font-medium leading-[31px]">Submit a Proposal</h1>
        <p className="mt-1.75 text-center text-xl font-medium wrap-break-word">{title}</p>
        {status && <p role="alert" className="mt-4 text-center text-sm text-destructive">{status}</p>}
        <div className="mt-8">
          <Label htmlFor="proposal-message">Message</Label>
          <Textarea id="proposal-message" name="message" required maxLength={10000} placeholder="Enter your message" value={message} onChange={(event) => setMessage(event.target.value)} className="mt-3 min-h-[360px] rounded-xl" />
        </div>
        <div className="mt-8.5">
          <h2 className="text-sm font-medium">Additional Attachments</h2>
          <DemoUploader photos={photos} onPhotosChange={onPhotosChange} onDrop={onDrop} onRemove={(index) => setPhotos((current) => current.filter((_, item) => item !== index))} />
        </div>
      </form>
    </main>
  )
}
