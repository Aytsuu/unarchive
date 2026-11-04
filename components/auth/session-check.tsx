"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState, type ReactNode } from "react"

type CheckState = "checking" | "guest" | "unavailable"

export function SessionCheck({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [state, setState] = useState<CheckState>("checking")

  useEffect(() => {
    const controller = new AbortController()

    async function checkSession() {
      try {
        const response = await fetch("/api/me", { cache: "no-store", signal: controller.signal })
        if (controller.signal.aborted) return
        if (response.status === 401) {
          setState("guest")
        } else if (response.ok) {
          router.replace("/home")
          router.refresh()
        } else {
          setState("unavailable")
        }
      } catch {
        if (!controller.signal.aborted) setState("unavailable")
      }
    }

    void checkSession()
    return () => controller.abort()
  }, [router])

  if (state === "checking") {
    return <main className="min-h-dvh bg-background" aria-busy="true"><p className="sr-only" role="status">Checking your session…</p></main>
  }

  return (
    <>
      {state === "unavailable" && <p role="status" className="px-5 pt-4 text-center text-sm text-muted-foreground">Could not check your session. You can still continue below.</p>}
      {children}
    </>
  )
}
