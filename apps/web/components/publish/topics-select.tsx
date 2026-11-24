"use client"

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useRef } from "react"
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { PROJECT_TOPICS } from "@/lib/project-topics.mjs"

export function TopicsSelect({ value, onChange }: { value: string[]; onChange: (value: string[]) => void }) {
  const anchor = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = anchor.current
    const fill = (event: Event) => {
      const selected: unknown = (event as CustomEvent).detail
      if (!Array.isArray(selected)) return
      onChange([...new Set(selected.filter((topic): topic is string => typeof topic === "string" && PROJECT_TOPICS.includes(topic)))])
    }
    element?.addEventListener("dev-autofill-topics", fill)
    return () => element?.removeEventListener("dev-autofill-topics", fill)
  }, [onChange])

  return (
    <Combobox multiple items={PROJECT_TOPICS} value={value} onValueChange={onChange}>
      <ComboboxChips ref={anchor} data-dev-topics aria-label="Topics" className="w-full bg-background">
        {value.map((topic) => (
          <ComboboxChip key={topic} showRemove={false} aria-label={topic} aria-description="Press Backspace or Delete to remove" className="gap-1 bg-secondary pr-1 text-secondary-foreground">
            {topic}
            <ComboboxPrimitive.ChipRemove aria-label={`Remove ${topic}`} className="flex size-4 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <HugeiconsIcon icon={Cancel01Icon} size={12} aria-hidden="true" />
            </ComboboxPrimitive.ChipRemove>
          </ComboboxChip>
        ))}
        <ComboboxChipsInput aria-label="Select topics" placeholder={value.length ? "" : "Select topics"} aria-description={value.length ? `${value.length} selected. Press left arrow at the start of the input to focus selected topics.` : undefined} />
      </ComboboxChips>
      <ComboboxContent anchor={anchor}>
        <ComboboxEmpty>No topics found.</ComboboxEmpty>
        <ComboboxList>
          {(topic: string) => <ComboboxItem key={topic} value={topic}>{topic}</ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
