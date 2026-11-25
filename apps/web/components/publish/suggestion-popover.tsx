"use client"

import { useState } from "react"
import { SparklesIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import type { ManuscriptCandidate, ManuscriptField } from "@/lib/manuscript/parser"

const labels: Record<ManuscriptField, string> = {
  title: "Project title",
  description: "Short description",
  abstract: "Abstract",
  institution: "Institution",
  authors: "Authors / contributors",
  year: "Completion year",
}

type SuggestionPopoverProps = {
  field: ManuscriptField
  candidates: ManuscriptCandidate[]
  onApply: (candidate: ManuscriptCandidate) => boolean | void
  onView: (candidate: ManuscriptCandidate) => void
}

export function SuggestionPopover({ field, candidates, onApply, onView }: SuggestionPopoverProps) {
  const [open, setOpen] = useState(false)
  if (!candidates.length) return null

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button type="button" variant="ghost" size="icon-sm" aria-label={`${labels[field]} suggestions`} className="text-primary" />}>
        <HugeiconsIcon icon={SparklesIcon} size={16} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" positionMethod="fixed" className="w-96 max-w-[calc(100vw-2rem)] gap-3">
        <PopoverTitle>{labels[field]} suggestions</PopoverTitle>
        <p className="text-muted-foreground">Review suggestions from your manuscript before using them.</p>
        <ul className="max-h-[min(55vh,28rem)] space-y-3 overflow-y-auto overscroll-contain pr-1">
          {candidates.map((candidate, index) => (
            <li key={`${candidate.value}-${index}`} className="space-y-2 border-b pb-3 last:border-0 last:pb-0">
              <p className="max-h-32 overflow-y-auto whitespace-pre-wrap wrap-break-word">{candidate.value}</p>
              <p className="text-xs text-muted-foreground">{candidate.needsReview ? "Needs review" : "Suggested"} · Page {candidate.locations[0]?.pageNumber ?? "?"}</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="xs" variant="secondary" onClick={() => { onView(candidate); setOpen(false) }}>View reference</Button>
                {field !== "year" || candidate.monthYear ? (
                  <Button type="button" size="xs" onClick={() => { if (onApply(candidate) !== false) setOpen(false) }}>Use suggestion</Button>
                ) : <span className="text-xs text-muted-foreground">Choose the month manually.</span>}
              </div>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
