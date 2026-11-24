"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createCitation, isLocalDevelopmentUrl, type CitationInput } from "@/lib/projects/citation"

export function ProjectCitation(props: CitationInput) {
  const citation = createCitation(props)
  const [status, setStatus] = useState("")

  async function copyCitation() {
    if (!citation.ok) return
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable")
      await navigator.clipboard.writeText(citation.text)
      setStatus("Citation copied.")
    } catch {
      setStatus("Unable to copy automatically. Select and copy the citation text instead.")
    }
  }

  return <Card className="gap-2 rounded-[20px] border p-5 ring-0">
    <CardHeader className="gap-0 p-0"><CardTitle>Copy citation</CardTitle></CardHeader>
    <CardContent className="space-y-3 p-0 text-sm">
      {citation.ok ? <>
        <p className="whitespace-pre-wrap wrap-break-word">{citation.beforeTitle}<em>{citation.title}</em>{citation.afterTitle}</p>
        <p className="text-xs text-muted-foreground">APA-style reference. Check author names and title capitalization against APA guidelines. {props.url ? props.version ? `This reference links to preserved version ${props.version}.` : "This link refers to the current project, not a specific version." : "A project URL is unavailable; add it before sharing the reference."}</p>
        {props.url && isLocalDevelopmentUrl(props.url) && <p className="text-xs text-muted-foreground">This development URL is only accessible on this device and should not be used as a public citation.</p>}
        <Button type="button" variant="secondary" onClick={copyCitation}>Copy citation</Button>
        <p role="status" aria-live="polite" className="text-xs text-muted-foreground">{status}</p>
      </> : <p className="text-muted-foreground">Citation unavailable. Missing or invalid: {citation.missing.join(", ")}.</p>}
    </CardContent>
  </Card>
}
