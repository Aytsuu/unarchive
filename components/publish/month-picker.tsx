"use client"

import { ArrowLeft01Icon, ArrowRight01Icon, Calendar03Icon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]
const validMonth = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/

export function MonthPicker({ id, label, value, min, onChange }: { id: string; label: string; value: string; min?: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState("")
  const triggerRef = useRef<HTMLButtonElement>(null)
  const validYear = /^(?!0000)\d{4}$/.test(year)

  useEffect(() => {
    const trigger = triggerRef.current
    const fill = (event: Event) => {
      const month: unknown = (event as CustomEvent).detail
      if (typeof month === "string" && validMonth.test(month)) onChange(month)
    }
    trigger?.addEventListener("dev-autofill-month", fill)
    return () => trigger?.removeEventListener("dev-autofill-month", fill)
  }, [onChange])

  function changeOpen(next: boolean) {
    if (next) setYear(validMonth.test(value) ? value.slice(0, 4) : String(new Date().getFullYear()))
    setOpen(next)
  }

  const display = validMonth.test(value) ? `${months[Number(value.slice(5)) - 1]} ${value.slice(0, 4)}` : "Select month"
  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger render={<Button ref={triggerRef} id={id} type="button" variant="outline" aria-label={label} data-dev-month-picker className="w-full min-w-0 justify-between font-normal" />}>
        <span className={value ? "truncate" : "truncate text-muted-foreground"}>{display}</span>
        <HugeiconsIcon icon={Calendar03Icon} size={16} aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent align="start" positionMethod="fixed" className="w-72 max-w-[calc(100vw-2rem)] gap-3" aria-label={`${label}: select month and year`}>
        <div className="flex items-center justify-between gap-2">
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous year" disabled={!validYear || year === "0001"} onClick={() => setYear(String(Number(year) - 1).padStart(4, "0"))}>
            <HugeiconsIcon icon={ArrowLeft01Icon} aria-hidden="true" />
          </Button>
          <Input type="number" aria-label="Year" min={1} max={9999} value={year} onChange={(event) => setYear(event.target.value)} className="w-24 text-center" />
          <Button type="button" variant="ghost" size="icon-sm" aria-label="Next year" disabled={!validYear || year === "9999"} onClick={() => setYear(String(Number(year) + 1).padStart(4, "0"))}>
            <HugeiconsIcon icon={ArrowRight01Icon} aria-hidden="true" />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1" role="group" aria-label="Months">
          {months.map((month, index) => {
            const choice = `${year}-${String(index + 1).padStart(2, "0")}`
            return <Button key={month} type="button" size="sm" variant={value === choice ? "default" : "ghost"} aria-label={`${month} ${year}`} aria-pressed={value === choice} disabled={!validYear || Boolean(min && choice < min)} onClick={() => { onChange(choice); setOpen(false) }}>{month.slice(0, 3)}</Button>
          })}
        </div>
        {value && <Button type="button" variant="ghost" size="sm" onClick={() => { onChange(""); setOpen(false) }}>Clear</Button>}
      </PopoverContent>
    </Popover>
  )
}
