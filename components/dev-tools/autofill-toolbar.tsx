"use client"

import { useEffect, useState } from "react"
import { autofillVisibleFields, hasAutofillFields, type AutofillConfig } from "./autofill"
import { Button } from "@/components/ui/button"

export function DevAutofillToolbar() {
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    const update = () => setVisible(hasAutofillFields())
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "aria-hidden", "disabled", "style", "class"] })
    return () => observer.disconnect()
  }, [])

  async function fill() {
    setPending(true)
    try {
      const response = await fetch("/api/dev/autofill", { cache: "no-store" })
      if (!response.ok) throw new Error("Could not load local autofill data.")
      const config = await response.json() as AutofillConfig
      const count = await autofillVisibleFields(config)
    } catch {
    } finally { setPending(false) }
  }

  if (!visible) return null
  return (
    <aside data-dev-autofill className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl" aria-label="Development tools">
      <Button type="button" size="sm" onClick={fill} disabled={pending} className={"bg-[#4d4d4d] hover:bg-[#616161] border-2 border-[#646464]"}>{pending ? "Filling..." : "Auto-fill"}</Button>
    </aside>
  )
}
