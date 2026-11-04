"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { authClient } from "@/lib/auth-client"

export function SignupFlow() {
  const router = useRouter()
  const [details, setDetails] = useState({ name: "", email: "", password: "", confirmPassword: "" })
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [showRecovery, setShowRecovery] = useState(false)

  function openVerification() {
    try { sessionStorage.setItem("verification-email", details.email.trim()) } catch {
      setError("Your browser could not save verification details. Enable session storage and try again.")
      return
    }
    router.replace("/verify-email")
  }

  async function signUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setShowRecovery(false)
    if (!details.name.trim()) return setError("Enter your name.")
    if (details.password.length < 8) return setError("Your password must contain at least 8 characters.")
    if (details.password !== details.confirmPassword) return setError("Passwords do not match.")
    const email = details.email.trim()
    setPending(true)
    try {
      const result = await authClient.signUp.email({ name: details.name.trim(), email, password: details.password })
      if (result.error) {
        setError(result.error.status === 429 ? "Too many attempts. Please wait and try again." : "Unable to complete signup. Please try again or sign in if you already have an account.")
        setShowRecovery(true)
        return
      }
      try {
        sessionStorage.setItem(`verification-resend-until:${email.toLowerCase()}`, String(Date.now() + 3 * 60 * 1000))
        sessionStorage.setItem(`verification-resend-version:${email.toLowerCase()}`, "2")
        sessionStorage.setItem("verification-email", email)
      } catch {
        setError("Your account may have been created, but verification details could not be saved. Enable session storage, then sign in to request a code.")
        setShowRecovery(true)
        return
      }
      setDetails({ name: "", email: "", password: "", confirmPassword: "" })
      router.replace("/verify-email")
    } catch {
      setError("Unable to complete signup right now. Please try again.")
      setShowRecovery(true)
    } finally {
      setPending(false)
    }
  }

  return (
    <main className="min-h-dvh bg-background px-5 pb-16 pt-16 text-foreground sm:pt-[204px]">
      <div className="mx-auto flex w-full flex-col items-center">
        <Link href="/" className="text-xl font-medium leading-10 focus-visible:outline-2 focus-visible:outline-ring">Unarchive</Link>
        <Progress value={25} aria-label="Signup progress" className="mt-9 w-[220px] [&_[data-slot=progress-track]]:h-2" />
        <form onSubmit={signUp} className="mt-[55px] w-full max-w-[240px]">
          <div className="space-y-[9px]">
            {([
              { key: "name", label: "Name", type: "text", autoComplete: "name" },
              { key: "email", label: "Email", type: "email", autoComplete: "email" },
              { key: "password", label: "Password", type: "password", autoComplete: "new-password" },
              { key: "confirmPassword", label: "Confirm password", type: "password", autoComplete: "new-password" },
            ] as const).map(({ key, label, type, autoComplete }) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={`signup-${key}`} className="text-sm font-medium">{label}</Label>
                <Input id={`signup-${key}`} name={key} type={type} autoComplete={autoComplete} required minLength={type === "password" ? 8 : undefined} maxLength={key === "name" ? 100 : type === "password" ? 128 : 254} placeholder="Enter text" value={details[key]} onChange={(event) => setDetails((current) => ({ ...current, [key]: event.target.value }))} className="text-sm" />
              </div>
            ))}
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          {showRecovery && <Button type="button" variant="link" className="mt-2 h-auto px-0 text-left whitespace-normal" onClick={openVerification}>Request a verification code</Button>}
          <Button type="submit" className="mt-10 w-full" disabled={pending}>{pending ? "Creating account…" : "Next"}</Button>
          <div className="mt-[45px] text-center text-sm font-medium leading-[normal]">
            <p>By continuing, you agree to our<br />Terms of Service and Privacy Policy.</p>
            <p className="mt-10">Have an account? <Link href="/login" replace className="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring">Log in</Link></p>
          </div>
        </form>
      </div>
    </main>
  )
}
