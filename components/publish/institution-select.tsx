"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Combobox, ComboboxContent, ComboboxInput, ComboboxItem, ComboboxList } from "@/components/ui/combobox"
import { normalizeInstitution, useInstitutions } from "@/components/institutions/institution-catalog"

export function InstitutionSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [input, setInput] = useState(value)
  const anchor = useRef<HTMLDivElement>(null)
  const { data = [], isError, isPending, refetch } = useInstitutions()
  const query = normalizeInstitution(input)
  const choices = useMemo(() => {
    const matches = data.filter((item) => !query || normalizeInstitution(item.name).includes(query)).slice(0, 40)
    const unique = [...new Set(matches.map((item) => item.name))]
    const custom = input.trim()
    if (custom && !data.some((item) => normalizeInstitution(item.name) === query)) unique.unshift(custom)
    return unique
  }, [data, input, query])

  useEffect(() => {
    const element = anchor.current
    const fill = (event: Event) => {
      const next: unknown = (event as CustomEvent).detail
      if (typeof next === "string") {
        const name = next.trim().slice(0, 200)
        setInput(name)
        onChange(name)
      }
    }
    element?.addEventListener("dev-autofill-institution", fill)
    return () => element?.removeEventListener("dev-autofill-institution", fill)
  }, [onChange])

  return <div ref={anchor} data-dev-institution aria-label="Institution" className="space-y-2">
    <Combobox items={choices} filteredItems={choices} value={value || null} onValueChange={(next: string | null) => { setInput(next ?? ""); onChange(next ?? "") }} inputValue={input} onInputValueChange={setInput}>
      <ComboboxInput id="institution" aria-label="Institution" placeholder="Search or enter an institution" maxLength={200} showClear className="w-full bg-background" />
      <ComboboxContent>
        {isPending && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Loading institutions...</p>}
        {isError && <p className="px-3 py-2 text-sm text-muted-foreground">Directory unavailable. You can still enter an institution. <button type="button" className="underline" onClick={() => refetch()}>Retry</button></p>}
        {!isPending && !choices.length && <p className="px-3 py-2 text-sm text-muted-foreground">No institutions found.</p>}
        <ComboboxList>{(name: string) => <ComboboxItem key={name} value={name}>
          <span className="min-w-0 truncate">{name}</span>
          {normalizeInstitution(name) === query && !data.some((item) => normalizeInstitution(item.name) === query) && <span className="ml-auto text-xs text-muted-foreground">Use custom name</span>}
        </ComboboxItem>}</ComboboxList>
      </ComboboxContent>
    </Combobox>
  </div>
}
