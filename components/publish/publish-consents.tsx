"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

type PublishConsentsProps = {
  permission: boolean
  contributorsPermission: boolean
  onPermissionChange: (checked: boolean) => void
  onContributorsPermissionChange: (checked: boolean) => void
}

export function PublishConsents({ permission, contributorsPermission, onPermissionChange, onContributorsPermissionChange }: PublishConsentsProps) {
  return (
    <fieldset className="mt-[50px] w-full space-y-5">
      <legend className="mb-3 text-lg font-medium">Consents</legend>
      <div className="flex items-start gap-3">
        <Checkbox id="publish-permission" checked={permission} onCheckedChange={onPermissionChange} />
        <Label htmlFor="publish-permission" className="leading-5">I have permission to share this project.</Label>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id="contributors-permission" checked={contributorsPermission} onCheckedChange={onContributorsPermissionChange} />
        <Label htmlFor="contributors-permission" className="leading-5">I have permission to include the contributors and materials in this project.</Label>
      </div>
    </fieldset>
  )
}
