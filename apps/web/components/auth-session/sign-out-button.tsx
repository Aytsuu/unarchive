"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"

export function SignOutButton() {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(false)

  async function signOut() {
    setPending(true)
    setError(false)
    try {
      const result = await authClient.signOut()
      if (result.error) {
        setError(true)
        return
      }
      router.replace("/login")
      router.refresh()
    } catch {
      setError(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-2 text-right">
      <Button type="button" variant="outline" disabled={pending} onClick={signOut}>
        {pending ? "Signing out…" : "Sign out"}
      </Button>
      {error && <p role="alert" className="text-sm text-destructive">Could not sign out. Please try again.</p>}
    </div>
  )
}
