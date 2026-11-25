"use client"

import { Delete02Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export type RepeatableField = { id: number; value: string }

type RepeatableFieldsProps = {
  fields: RepeatableField[]
  kind: "link" | "contributor"
  variant?: "default" | "soft"
  onAdd: () => void
  onChange: (fields: RepeatableField[]) => void
}

export function RepeatableFields({ fields, kind, variant = "default", onAdd, onChange }: RepeatableFieldsProps) {
  return (
    <div className="space-y-3">
      {fields.map((field, index) => (
        <div key={field.id} className={`flex h-9 items-center overflow-hidden ${variant === "soft" ? "rounded-xl" : "rounded-4xl"} border border-input bg-input/30 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50`}>
          <Input
            variant={variant}
            aria-label={`${kind === "link" ? "Link" : "Contributor"} ${index + 1}`}
            placeholder={kind === "link" ? "Add the URL" : "Enter a contributor's name"}
            type={kind === "link" ? "url" : "text"}
            maxLength={kind === "link" ? 2048 : 200}
            className="h-full flex-1 rounded-none border-0 bg-transparent focus-visible:ring-0"
            value={field.value}
            onChange={(event) => onChange(fields.map((item) => item.id === field.id ? { ...item, value: event.target.value } : item))}
          />
          <Button type="button" variant="ghost" size="icon" className="h-full w-10 rounded-none border-0 border-l border-input" aria-label={`Remove ${kind} ${index + 1}`} onClick={() => onChange(fields.filter((item) => item.id !== field.id))}>
            <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} aria-hidden="true" />
          </Button>
        </div>
      ))}
      <Button type="button" onClick={onAdd}>Add {kind}</Button>
    </div>
  )
}
