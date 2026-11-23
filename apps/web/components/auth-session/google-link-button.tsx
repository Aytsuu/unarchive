"use client"

import { useState } from "react"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export function GoogleLinkButton({ callbackError }: { callbackError: boolean }) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(callbackError)

  async function connectGoogle() {
    setPending(true)
    setError(false)
    try {
      const result = await authClient.linkSocial({ provider: "google", callbackURL: "/settings", errorCallbackURL: "/settings?error=google_link" })
      if (result.error) setError(true)
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" disabled={pending} onClick={connectGoogle}>
        {pending ? "Connecting…" : "Connect Google"}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">Could not connect Google. Please try again.</p>}
    </div>
  )
}
