"use client"

import type { ReactNode } from "react"
import { InstitutionSelect } from "@/components/publish/institution-select"
import { Label } from "@/components/ui/label"
import { RepeatableFields, type RepeatableField } from "@/components/publish/repeatable-fields"
import { MonthPicker } from "@/components/publish/month-picker"
import { ReferenceProjects, type ReferenceProject } from "@/components/publish/reference-projects"

type ProjectCreditsProps = {
  institution: string
  onInstitutionChange: (value: string) => void
  dateEnded: string
  minDateEnded?: string
  onDateEndedChange: (value: string) => void
  contributors: RepeatableField[]
  onAddContributor: () => void
  onContributorsChange: (contributors: RepeatableField[]) => void
  referenceProjects: ReferenceProject[]
  onReferenceProjectsChange: (projects: ReferenceProject[]) => void
  variant?: "default" | "soft"
  renderSuggestion?: (field: "institution" | "year" | "authors") => ReactNode
}

export function ProjectCredits({ institution, onInstitutionChange, dateEnded, minDateEnded, onDateEndedChange, contributors, onAddContributor, onContributorsChange, referenceProjects, onReferenceProjectsChange, variant = "default", renderSuggestion }: ProjectCreditsProps) {
  return (
    <div className="mt-12.5 w-full space-y-8">
      <div className="space-y-2">
        <div className="flex items-center gap-2"><Label htmlFor="institution">Institution</Label>{renderSuggestion?.("institution")}</div>
        <InstitutionSelect value={institution} onChange={onInstitutionChange} variant={variant} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2"><Label htmlFor="date-ended">Completion Year</Label>{renderSuggestion?.("year")}</div>
        <MonthPicker id="date-ended" label="Completion year" value={dateEnded} min={minDateEnded || undefined} onChange={onDateEndedChange} variant={variant} />
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-2"><h2 className="text-sm font-medium">Authors / contributors</h2>{renderSuggestion?.("authors")}</div>
        <p className="text-sm text-muted-foreground">Names listed here appear as authors in the project citation, in order.</p>
        <RepeatableFields kind="contributor" fields={contributors} onAdd={onAddContributor} onChange={onContributorsChange} variant={variant} />
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-medium" id="reference-projects-heading">Reference Projects</h2>
        <p className="text-sm text-muted-foreground">Find published projects that informed this work.</p>
        <Label htmlFor="reference-projects-search">Search</Label>
        <ReferenceProjects value={referenceProjects} onChange={onReferenceProjectsChange} variant={variant} />
      </div>
    </div>
  )
}
