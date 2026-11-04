"use client"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RepeatableFields, type RepeatableField } from "@/components/publish/repeatable-fields"

type ProjectCreditsProps = {
  institution: string
  onInstitutionChange: (value: string) => void
  contributors: RepeatableField[]
  onAddContributor: () => void
  onContributorsChange: (contributors: RepeatableField[]) => void
}

export function ProjectCredits({ institution, onInstitutionChange, contributors, onAddContributor, onContributorsChange }: ProjectCreditsProps) {
  return (
    <div className="mt-[50px] w-full space-y-8">
      <div className="space-y-2">
        <Label htmlFor="institution">Institution</Label>
        <Input id="institution" placeholder="Enter institution" value={institution} onChange={(event) => onInstitutionChange(event.target.value)} />
      </div>
      <div className="space-y-2">
        <h2 className="text-sm font-medium">Contributors</h2>
        <p className="text-sm text-muted-foreground">Add the people who contributed to this project.</p>
        <RepeatableFields kind="contributor" fields={contributors} onAdd={onAddContributor} onChange={onContributorsChange} />
      </div>
    </div>
  )
}
