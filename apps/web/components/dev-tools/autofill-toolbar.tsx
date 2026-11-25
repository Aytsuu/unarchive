"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { autofillVisibleFields, hasAutofillFields, type AutofillConfig } from "./autofill"
import { Button } from "@/components/ui/button"

export function DevAutofillToolbar() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const [pending, setPending] = useState(false)
  const [moderator, setModerator] = useState<boolean | null>(null)
  const [grantState, setGrantState] = useState<"idle" | "pending" | "error">("idle")
  const [grantMessage, setGrantMessage] = useState("")

  useEffect(() => {
    const update = () => setVisible(hasAutofillFields())
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden", "aria-hidden", "disabled", "style", "class"] })
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    setGrantMessage("")
    fetch("/api/dev/moderator", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) return setModerator(false)
        const payload: unknown = await response.json()
        setModerator(typeof payload === "object" && payload !== null && "granted" in payload && payload.granted === true)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        setModerator(false)
      })
    return () => controller.abort()
  }, [pathname])

  async function fill() {
    setPending(true)
    try {
      const response = await fetch("/api/dev/autofill", { cache: "no-store" })
      if (!response.ok) throw new Error("Could not load local autofill data.")
      const config = await response.json() as AutofillConfig
      await autofillVisibleFields(config)
    } catch {
    } finally { setPending(false) }
  }

  async function grantModerator() {
    setGrantState("pending")
    setGrantMessage("")
    try {
      const response = await fetch("/api/dev/moderator", { method: "POST" })
      if (response.status === 401) {
        setGrantState("error")
        setGrantMessage("Sign in first.")
        return
      }
      if (!response.ok) throw new Error("Could not grant moderator access.")
      setModerator(true)
      setGrantState("idle")
      setGrantMessage("Moderator access granted.")
    } catch {
      setGrantState("error")
      setGrantMessage("Could not grant moderator access.")
    }
  }

  const showGrant = moderator === false
  if (!visible && !showGrant && !grantMessage) return null

  return (
    <aside data-dev-autofill className="fixed bottom-4 left-4 z-50 flex max-w-[calc(100vw-2rem)] flex-col items-start gap-2" aria-label="Development tools">
      {grantMessage ? <p role="status" className="rounded-2xl bg-background px-3 py-2 text-xs text-foreground shadow-sm">{grantMessage}</p> : null}
      {visible || showGrant ? <div className="flex items-center gap-2">
        {visible ? <Button type="button" size="sm" onClick={fill} disabled={pending} className="border-2 border-[#646464] bg-[#4d4d4d] hover:bg-[#616161]">{pending ? "Filling..." : "Auto-fill"}</Button> : null}
        {showGrant ? <Button type="button" size="sm" onClick={grantModerator} disabled={grantState === "pending"} className="border-2 border-[#646464] bg-[#4d4d4d] hover:bg-[#616161]">{grantState === "pending" ? "Granting..." : "Set as moderator"}</Button> : null}
      </div> : null}
    </aside>
  )
}
