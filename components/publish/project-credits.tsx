"use client"

import { InstitutionSelect } from "@/components/publish/institution-select"
import { Label } from "@/components/ui/label"
import { RepeatableFields, type RepeatableField } from "@/components/publish/repeatable-fields"
import { MonthPicker } from "@/components/publish/month-picker"
import { ReferenceProjects, type ReferenceProject } from "@/components/publish/reference-projects"

type ProjectCreditsProps = {
  institution: string
  onInstitutionChange: (value: string) => void
  dateStarted: string
  dateEnded: string
  onDateStartedChange: (value: string) => void
  onDateEndedChange: (value: string) => void
  contributors: RepeatableField[]
  onAddContributor: () => void
  onContributorsChange: (contributors: RepeatableField[]) => void
  referenceProjects: ReferenceProject[]
  onReferenceProjectsChange: (projects: ReferenceProject[]) => void
}

export function ProjectCredits({ institution, onInstitutionChange, dateStarted, dateEnded, onDateStartedChange, onDateEndedChange, contributors, onAddContributor, onContributorsChange, referenceProjects, onReferenceProjectsChange }: ProjectCreditsProps) {
  return (
    <div className="mt-12.5 w-full space-y-8">
      <div className="space-y-2">
        <Label htmlFor="institution">Institution</Label>
        <InstitutionSelect value={institution} onChange={onInstitutionChange} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="date-started">Date started</Label>
          <MonthPicker id="date-started" label="Date started" value={dateStarted} onChange={onDateStartedChange} />
        </div>
        <div className="flex min-w-0 flex-col gap-2">
          <Label htmlFor="date-ended">Date ended</Label>
          <MonthPicker id="date-ended" label="Date ended" min={dateStarted || undefined} value={dateEnded} onChange={onDateEndedChange} />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Contributors</h2>
        <p className="text-sm text-muted-foreground">Add the people who contributed to this project.</p>
        <RepeatableFields kind="contributor" fields={contributors} onAdd={onAddContributor} onChange={onContributorsChange} />
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-medium" id="reference-projects-heading">Reference projects</h2>
        <p className="text-sm text-muted-foreground">Find published projects that informed this work.</p>
        <ReferenceProjects value={referenceProjects} onChange={onReferenceProjectsChange} />
      </div>
    </div>
  )
}
