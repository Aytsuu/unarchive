"use client"

import { Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type RepeatableField = { id: number; value: string }

type RepeatableFieldsProps = {
  fields: RepeatableField[]
  kind: "link" | "contributor"
  onAdd: () => void
  onChange: (fields: RepeatableField[]) => void
}

export function RepeatableFields({ fields, kind, onAdd, onChange }: RepeatableFieldsProps) {
  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={field.id} className="flex items-center gap-2">
          <Input
            aria-label={`${kind === "link" ? "Link" : "Contributor"} ${index + 1}`}
            placeholder={kind === "link" ? "Add the URL" : "Enter a contributor's name"}
            type={kind === "link" ? "url" : "text"}
            value={field.value}
            onChange={(event) => onChange(fields.map((item) => item.id === field.id ? { ...item, value: event.target.value } : item))}
          />
          <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${kind} ${index + 1}`} onClick={() => onChange(fields.filter((item) => item.id !== field.id))}>
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button type="button" onClick={onAdd}>Add {kind}</Button>
    </div>
  )
}
