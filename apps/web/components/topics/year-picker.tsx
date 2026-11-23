"use client"

import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useState, type RefObject } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const validYear = /^(?!0000)\d{4}$/
const overlayAvoidance = { side: "flip" as const, align: "shift" as const, fallbackAxisSide: "none" as const }

export function YearPicker({ id, label, value, min, max, anchor, onChange }: { id: string; label: string; value: string; min?: string; max?: string; anchor?: RefObject<Element | null>; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(value)

  function changeOpen(next: boolean) {
    if (next) setYear(validYear.test(value) ? value : String(new Date().getFullYear()))
    setOpen(next)
  }

  function commit(next: string) {
    if (!validYear.test(next)) return
    if (min && next < min) return
    if (max && next > max) return
    onChange(next)
    setOpen(false)
  }

  const outOfRange = validYear.test(year) && ((min && year < min) || (max && year > max))
  const disabled = outOfRange || !validYear.test(year)
  const atMin = !validYear.test(year) || year === "0001" || Boolean(min && year <= min)
  const atMax = !validYear.test(year) || year === "9999" || Boolean(max && year >= max)

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger render={<Button id={id} type="button" variant="outline" aria-label={label} className="h-9 w-full min-w-0 justify-start rounded-full border-border bg-input font-normal hover:bg-input/80" />}>
        <span className={value ? "truncate" : "truncate text-muted-foreground"}>{value || label}</span>
      </PopoverTrigger>
      <PopoverContent
        data-filter-overlay=""
        align="start"
        side="left"
        sideOffset={8}
        positionMethod="fixed"
        anchor={anchor}
        collisionAvoidance={overlayAvoidance}
        className="z-[60] w-56 max-w-[calc(100vw-2rem)] gap-3"
        aria-label={`${label}: select year`}
      >
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous year" disabled={atMin} onClick={() => setYear(String(Number(year) - 1).padStart(4, "0"))}>
            <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" />
          </Button>
          <Input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{4}"
            maxLength={4}
            aria-label="Year"
            value={year}
            onChange={(event) => setYear(event.target.value.replace(/\D/g, "").slice(0, 4))}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); commit(year) } }}
            className="w-24 bg-background text-center"
          />
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Next year" disabled={atMax} onClick={() => setYear(String(Number(year) + 1).padStart(4, "0"))}>
            <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden="true" />
          </Button>
        </div>
        <Button type="button" size="sm" disabled={Boolean(disabled)} onClick={() => commit(year)}>Use year</Button>
        {value && <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(""); setOpen(false) }}>Clear</Button>}
      </PopoverContent>
    </Popover>
  )
}
