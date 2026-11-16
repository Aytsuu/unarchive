"use client"

import { useEffect, useRef, useState } from "react"
import { InstitutionsFilter } from "@/components/topics/institutions-filter"
import { YearPicker } from "@/components/topics/year-picker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { LISTING_SORT_OPTIONS } from "@/lib/projects/listing-params.mjs"

export type TopicFilters = { sort: string; yearFrom: string; yearTo: string; institutions: string[]; search: string }

const overlayAvoidance = { side: "flip" as const, align: "shift" as const, fallbackAxisSide: "none" as const }

export function AdvancedFilters({ value, onChange }: { value: TopicFilters; onChange: (value: TopicFilters) => void }) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState(value.search)
  const panel = useRef<HTMLDivElement>(null)
  const valueRef = useRef(value)
  valueRef.current = value

  useEffect(() => { setKeyword(value.search) }, [value.search])
  useEffect(() => {
    if (keyword === valueRef.current.search) return
    const timer = setTimeout(() => {
      const next = { ...valueRef.current, search: keyword }
      if (next.yearFrom && next.yearTo && next.yearFrom > next.yearTo) return
      onChange(next)
    }, 300)
    return () => clearTimeout(timer)
  }, [keyword, onChange])

  function update(patch: Partial<TopicFilters>) {
    const next = { ...value, search: keyword, ...patch }
    if (next.yearFrom && next.yearTo && next.yearFrom > next.yearTo) return
    onChange(next)
  }

  return (
    <Popover open={open} onOpenChange={(next, details) => {
      if (!next && details.reason === "outside-press") {
        const target = details.event.target
        if (target instanceof Element && target.closest("[data-filter-overlay], [data-slot='command']")) {
          details.cancel()
          return
        }
      }
      setOpen(next)
    }}>
      <PopoverTrigger render={<Button type="button" variant="ghost" className="h-8 gap-2 rounded-full px-3 font-medium" />}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/assets/icons/filter.svg" alt="" width={16} height={16} className="size-4" />
        Advanced filters
      </PopoverTrigger>
      <PopoverContent ref={panel} align="end" side="bottom" className="z-50 w-[20.3125rem] gap-4 overflow-visible rounded-[20px] border p-5 shadow-2xl">
        <PopoverHeader className="gap-0">
          <PopoverTitle className="text-sm font-medium">Apply filters</PopoverTitle>
          <PopoverDescription className="sr-only">Sort and filter projects in this topic.</PopoverDescription>
        </PopoverHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="topic-sort" className="text-xs font-normal text-foreground">Sort By</Label>
          <Select items={[...LISTING_SORT_OPTIONS]} value={value.sort || null} onValueChange={(sort) => update({ sort: sort ?? "" })} modal={false}>
            <SelectTrigger id="topic-sort" className="h-9 w-full rounded-full bg-background">
              <SelectValue placeholder="Select an option" />
            </SelectTrigger>
            <SelectContent
              data-filter-overlay=""
              side="left"
              align="start"
              alignItemWithTrigger={false}
              sideOffset={8}
              anchor={panel}
              positionMethod="fixed"
              collisionAvoidance={overlayAvoidance}
              className="z-[60]"
            >
              {LISTING_SORT_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-foreground">Completion Year</p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <YearPicker id="year-from" label="From" value={value.yearFrom} max={value.yearTo || undefined} anchor={panel} onChange={(yearFrom) => update({ yearFrom })} />
            <span aria-hidden="true" className="h-px w-7 bg-border" />
            <YearPicker id="year-to" label="To" value={value.yearTo} min={value.yearFrom || undefined} anchor={panel} onChange={(yearTo) => update({ yearTo })} />
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-xs text-foreground">Institutions</p>
          <InstitutionsFilter value={value.institutions} anchor={panel} onChange={(institutions) => update({ institutions })} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="topic-keyword" className="text-xs font-normal text-foreground">Keyword</Label>
          <Input id="topic-keyword" value={keyword} maxLength={100} placeholder="Title contains" onChange={(event) => setKeyword(event.target.value)} className="h-9 bg-background" />
        </div>
      </PopoverContent>
    </Popover>
  )
}
