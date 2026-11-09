"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

type PublishConsentsProps = {
  permission: boolean
  contributorsPermission: boolean
  detailsAccurate: boolean
  onPermissionChange: (checked: boolean) => void
  onContributorsPermissionChange: (checked: boolean) => void
  onDetailsAccurateChange: (checked: boolean) => void
  disabled?: boolean
}

export function PublishConsents({ permission, contributorsPermission, detailsAccurate, onPermissionChange, onContributorsPermissionChange, onDetailsAccurateChange, disabled = false }: PublishConsentsProps) {
  return (
    <fieldset className="mt-12.5 w-full space-y-5">
      <legend className="mb-3 text-lg font-medium">Consents</legend>
      <div className="flex items-start gap-3">
        <Checkbox id="publish-permission" checked={permission} onCheckedChange={onPermissionChange} disabled={disabled} />
        <Label htmlFor="publish-permission" className="leading-5">I have permission to share this project.</Label>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id="contributors-permission" checked={contributorsPermission} onCheckedChange={onContributorsPermissionChange} disabled={disabled} />
        <Label htmlFor="contributors-permission" className="leading-5">I have permission to include the contributors and materials in this project.</Label>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id="details-accurate" checked={detailsAccurate} onCheckedChange={onDetailsAccurateChange} disabled={disabled} />
        <Label htmlFor="details-accurate" className="leading-5">I confirm that all details provided are accurate and not falsified.</Label>
      </div>
    </fieldset>
  )
}
