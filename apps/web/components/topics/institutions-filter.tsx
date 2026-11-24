"use client"

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { startTransition, useEffect, useMemo, useState, type RefObject } from "react"
import { normalizeInstitution, useInstitutions } from "@/components/institutions/institution-catalog"
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

const MATCH_LIMIT = 40
const overlayAvoidance = { side: "flip" as const, align: "shift" as const, fallbackAxisSide: "none" as const }

export function InstitutionsFilter({ value, onChange, anchor }: { value: string[]; onChange: (value: string[]) => void; anchor?: RefObject<Element | null> }) {
  const [selected, setSelected] = useState(value)
  const [input, setInput] = useState("")
  const valueKey = value.join("\0")
  useEffect(() => { setSelected(valueKey === "" ? [] : valueKey.split("\0")) }, [valueKey])
  const { data = [], isError, isPending, refetch } = useInstitutions()
  const names = useMemo(() => [...new Set(data.map((item) => item.name))], [data])
  const query = normalizeInstitution(input)
  const choices = useMemo(() => {
    const matches = query ? names.filter((name) => normalizeInstitution(name).includes(query)) : names
    return matches.slice(0, MATCH_LIMIT)
  }, [names, query])

  function change(next: string[]) {
    setSelected(next)
    setInput("")
    startTransition(() => onChange(next))
  }

  return (
    <Combobox multiple items={choices} filteredItems={choices} value={selected} onValueChange={change} inputValue={input} onInputValueChange={setInput} limit={MATCH_LIMIT}>
      <ComboboxChips aria-label="Institutions" className="w-full bg-background">
        {selected.map((institution) => (
          <ComboboxChip key={institution} showRemove={false} aria-label={institution} className="gap-1 bg-secondary pr-1 text-secondary-foreground">
            {institution}
            <ComboboxPrimitive.ChipRemove aria-label={`Remove ${institution}`} className="flex size-4 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <HugeiconsIcon icon={Cancel01Icon} size={12} aria-hidden="true" />
            </ComboboxPrimitive.ChipRemove>
          </ComboboxChip>
        ))}
        <ComboboxChipsInput aria-label="Search institutions" placeholder={selected.length ? "" : "Search institutions"} />
      </ComboboxChips>
      <ComboboxContent
        data-filter-overlay=""
        anchor={anchor}
        side="left"
        sideOffset={8}
        align="start"
        positionMethod="fixed"
        collisionAvoidance={overlayAvoidance}
        className="z-[60]"
      >
        {isPending && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Loading institutions...</p>}
        {isError && <p className="px-3 py-2 text-sm text-muted-foreground">Directory unavailable. <button type="button" className="underline" onClick={() => refetch()}>Retry</button></p>}
        <ComboboxEmpty>No institutions found.</ComboboxEmpty>
        <ComboboxList>
          {(name: string) => <ComboboxItem key={name} value={name}><span className="min-w-0 truncate">{name}</span></ComboboxItem>}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
