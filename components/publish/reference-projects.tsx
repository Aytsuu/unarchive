"use client"

import { Combobox as ComboboxPrimitive } from "@base-ui/react/combobox"
import { Cancel01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useRef, useState } from "react"
import {
  Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput,
  ComboboxContent, ComboboxItem, ComboboxList,
} from "@/components/ui/combobox"

export type ReferenceProject = { id: string; title: string }

type SearchState = { query: string; projects: ReferenceProject[]; error: string }
const MAX_REFERENCES = 20

function readProjects(payload: unknown): ReferenceProject[] {
  if (!payload || typeof payload !== "object" || !("data" in payload)) throw new Error("Invalid response")
  const data = payload.data
  if (!data || typeof data !== "object" || !("projects" in data) || !Array.isArray(data.projects)) throw new Error("Invalid response")
  return data.projects.filter((project): project is ReferenceProject => Boolean(project && typeof project === "object" && typeof project.id === "string" && typeof project.title === "string"))
}

export function ReferenceProjects({ value, onChange }: { value: ReferenceProject[]; onChange: (projects: ReferenceProject[]) => void }) {
  const anchor = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState("")
  const [search, setSearch] = useState<SearchState | null>(null)
  const [retry, setRetry] = useState(0)
  const query = input.trim()

  useEffect(() => {
    if (!open || query.length > 100) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        const params = new URLSearchParams({ q: query })
        const response = await fetch(`/api/projects/search?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error("Search failed")
        const projects = readProjects(await response.json())
        if (!controller.signal.aborted) setSearch({ query, projects, error: "" })
      } catch {
        if (!controller.signal.aborted) setSearch({ query, projects: [], error: "Could not load projects. Please try again." })
      }
    }, 250)
    return () => { window.clearTimeout(timer); controller.abort() }
  }, [open, query, retry])

  const current = search?.query === query ? search : null
  const projects = current?.projects ?? []

  function updateSelection(next: ReferenceProject[]) {
    const unique = [...new Map(next.map((project) => [project.id, project])).values()]
    if (unique.length <= MAX_REFERENCES) onChange(unique)
  }

  return (
    <div className="space-y-2">
      <Combobox multiple items={projects} filteredItems={projects} value={value} onValueChange={(next, details) => { if (details.reason !== "escape-key") updateSelection(next) }}
        itemToStringLabel={(project: ReferenceProject) => project.title}
        isItemEqualToValue={(a: ReferenceProject, b: ReferenceProject) => a.id === b.id}
        inputValue={input} onInputValueChange={setInput} open={open} onOpenChange={setOpen}>
        <ComboboxChips ref={anchor} className="w-full bg-background">
          {value.map((project) => <ComboboxChip key={project.id} showRemove={false} aria-label={project.title} className="max-w-full gap-1 bg-secondary pr-1 text-secondary-foreground">
            <span className="truncate">{project.title}</span>
            <ComboboxPrimitive.ChipRemove aria-label={`Remove ${project.title}`} className="flex size-4 shrink-0 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <HugeiconsIcon icon={Cancel01Icon} size={12} aria-hidden="true" />
            </ComboboxPrimitive.ChipRemove>
          </ComboboxChip>)}
          <ComboboxChipsInput aria-label="Search reference projects" placeholder={value.length ? "Add another project" : "Search published projects"} maxLength={100} />
        </ComboboxChips>
        <ComboboxContent anchor={anchor}>
          {!current && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">Searching projects…</p>}
          {current?.error && <div className="px-3 py-2 text-sm text-destructive" role="alert">{current.error} <button type="button" className="underline" onClick={() => { setSearch(null); setRetry((n) => n + 1) }}>Retry</button></div>}
          {current && !current.error && !projects.length && <p role="status" className="px-3 py-2 text-sm text-muted-foreground">No projects found.</p>}
          <ComboboxList>
            {(project: ReferenceProject) => <ComboboxItem key={project.id} value={project} disabled={value.length >= MAX_REFERENCES && !value.some((item) => item.id === project.id)}>{project.title}</ComboboxItem>}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
      {value.length >= MAX_REFERENCES && <p className="text-sm text-muted-foreground">You can select up to {MAX_REFERENCES} projects.</p>}
    </div>
  )
}
