"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"

type PublishConsentsProps = {
  publishRights: boolean
  contributorAccuracy: boolean
  onPublishRightsChange: (checked: boolean) => void
  onContributorAccuracyChange: (checked: boolean) => void
  disabled?: boolean
}

export function PublishConsents({
  publishRights,
  contributorAccuracy,
  onPublishRightsChange,
  onContributorAccuracyChange,
  disabled = false,
}: PublishConsentsProps) {
  return (
    <fieldset className="mt-12.5 w-full space-y-5">
      <legend className="text-lg font-medium">Before you publish</legend>
      <p className="text-sm text-muted-foreground">Your project will be publicly accessible and may be discovered, shared, and cited by others.</p>
      <div className="flex items-start gap-3">
        <Checkbox id="publish-rights" checked={publishRights} onCheckedChange={(checked) => onPublishRightsChange(checked === true)} disabled={disabled} />
        <Label htmlFor="publish-rights" className="leading-5">I confirm that I have the necessary rights and permissions to publish this project and its materials.</Label>
      </div>
      <div className="flex items-start gap-3">
        <Checkbox id="publish-accuracy" checked={contributorAccuracy} onCheckedChange={(checked) => onContributorAccuracyChange(checked === true)} disabled={disabled} />
        <Label htmlFor="publish-accuracy" className="leading-5">I confirm that the information is accurate and that I am authorized to publicly share the contributor details provided.</Label>
      </div>
    </fieldset>
  )
}
