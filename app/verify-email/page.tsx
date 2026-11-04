"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useSyncExternalStore } from "react"
import { REGEXP_ONLY_DIGITS } from "input-otp"
import { Button } from "@/components/ui/button"
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { authClient } from "@/lib/auth-client"

function subscribeToEmail(onChange: () => void) {
  window.addEventListener("verification-deadline-change", onChange)
  return () => window.removeEventListener("verification-deadline-change", onChange)
}

function getVerificationEmail() {
  try { return sessionStorage.getItem("verification-email")?.trim() || null } catch { return null }
}

function getServerEmail() {
  return undefined
}

function subscribeToClock(onChange: () => void) {
  const timer = window.setInterval(onChange, 1000)
  return () => window.clearInterval(timer)
}

function getStoredDeadline() {
  try {
    const email = getVerificationEmail()
    return email ? sessionStorage.getItem(`verification-resend-until:${email.toLowerCase()}`) : null
  } catch { return null }
}

function getServerDeadline() {
  return null
}

export default function VerifyEmailPage() {
  const router = useRouter()
  const email = useSyncExternalStore(subscribeToEmail, getVerificationEmail, getServerEmail)
  const [otp, setOtp] = useState("")
  const [pending, setPending] = useState(false)
  const [verified, setVerified] = useState(false)
  const pendingRef = useRef(false)
  const [localDeadline, setLocalDeadline] = useState<{ email: string; until: number } | null>(null)
  const [error, setError] = useState("")
  const storedDeadline = useSyncExternalStore(subscribeToEmail, getStoredDeadline, getServerDeadline)

  useEffect(() => {
    if (!email || !storedDeadline) return
    try {
      const key = email.toLowerCase()
      if (sessionStorage.getItem(`verification-resend-version:${key}`) !== "2") {
        sessionStorage.setItem(`verification-resend-until:${key}`, String(Number(storedDeadline) - 2 * 60 * 1000))
        sessionStorage.setItem(`verification-resend-version:${key}`, "2")
        window.dispatchEvent(new Event("verification-deadline-change"))
      }
    } catch { /* Existing storage may be unavailable. */ }
  }, [email, storedDeadline])
  const deadline = Math.max(
    Number(storedDeadline) || 0,
    localDeadline && localDeadline.email === email?.toLowerCase() ? localDeadline.until : 0,
  )
  const cooldown = useSyncExternalStore(
    subscribeToClock,
    () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000)),
    () => 0,
  )

  async function verify(code: string) {
    if (pendingRef.current) return
    setError("")
    if (!email) return setError("Your email is unavailable. Return to signup or login to continue.")
    if (!/^\d{6}$/.test(code)) return
    pendingRef.current = true
    setPending(true)
    let result
    try {
      result = await authClient.emailOtp.verifyEmail({ email, otp: code })
    } catch {
      setError("Unable to verify your email right now. Please try again.")
      setOtp("")
      pendingRef.current = false
      setPending(false)
      return
    }
    if (result.error) {
      setError(result.error.status === 429 ? "Too many attempts. Please wait and try again." : "The code is invalid or expired. Request a new code and try again.")
      setOtp("")
      pendingRef.current = false
      setPending(false)
      return
    }
    setVerified(true)
    try {
      sessionStorage.removeItem(`verification-resend-until:${email.toLowerCase()}`)
      sessionStorage.removeItem(`verification-resend-version:${email.toLowerCase()}`)
      sessionStorage.removeItem("verification-email")
    } catch { /* Storage may be unavailable. */ }
    router.replace("/get-to-know")
    router.refresh()
  }

  async function resend() {
    if (pendingRef.current) return
    setError("")
    if (!email) return setError("Your email is unavailable. Return to signup or login to continue.")
    pendingRef.current = true
    setPending(true)
    try {
      let retryAfter = 0
      const result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
        fetchOptions: {
          onError(context) {
            retryAfter = Number(context.response.headers.get("Retry-After") ?? context.response.headers.get("X-Retry-After")) || 0
          },
        },
      })
      if (result.error) {
        if (result.error.status === 429 && retryAfter > 0) {
          const until = Date.now() + Math.min(retryAfter, 86400) * 1000
          setLocalDeadline({ email: email.toLowerCase(), until })
          try { sessionStorage.setItem(`verification-resend-until:${email.toLowerCase()}`, String(until)); sessionStorage.setItem(`verification-resend-version:${email.toLowerCase()}`, "2") } catch { /* Keep the in-memory countdown. */ }
        }
        setError(result.error.status === 429 ? "Too many requests. Please wait before requesting another code." : "Unable to request a code right now. Please try again.")
        return
      }
      const until = Date.now() + 3 * 60 * 1000
      setLocalDeadline({ email: email.toLowerCase(), until })
      try { sessionStorage.setItem(`verification-resend-until:${email.toLowerCase()}`, String(until)); sessionStorage.setItem(`verification-resend-version:${email.toLowerCase()}`, "2") } catch { /* Keep the in-memory countdown. */ }
      setOtp("")
    } catch {
      setError("Unable to request a code right now. Please try again.")
    } finally {
      pendingRef.current = false
      setPending(false)
    }
  }

  return (
    <main className="min-h-dvh bg-background px-5 pb-16 pt-16 text-foreground sm:pt-[204px]">
      <div className="mx-auto flex w-full flex-col items-center">
        <Link href="/" className="text-xl font-medium leading-10 focus-visible:outline-2 focus-visible:outline-ring">Unarchive</Link>
        <Progress value={65} aria-label="Signup progress" className="mt-9 w-[220px] [&_[data-slot=progress-track]]:h-2" />
        {verified ? (
          <p className="mt-6 text-sm text-muted-foreground" role="status">Email verified. Continuing...</p>
        ) : email === undefined ? (
          <p className="mt-6 text-sm text-muted-foreground" role="status">Loading verification details…</p>
        ) : email === null ? (
          <div className="mt-6 w-full max-w-[280px] space-y-4 text-center text-sm" role="status">
            <p>Your verification email is unavailable. Return to signup or login to continue.</p>
            <div className="flex justify-center gap-4">
              <Link href="/signup" replace className="underline underline-offset-4">Sign up</Link>
              <Link href="/login" replace className="underline underline-offset-4">Log in</Link>
            </div>
          </div>
        ) : <div className="mt-6 flex w-full max-w-[280px] flex-col items-center" aria-busy={pending}>
          <h1 className="text-center text-sm font-medium">Verify your email</h1>
          <p className="mt-3 text-center text-sm text-muted-foreground">Enter the six-digit code for <span className="break-all font-medium text-foreground">{email}</span>. Codes expire after five minutes.</p>
          <Label htmlFor="verify-code" className="mt-6 self-start">Verification code</Label>
          <InputOTP id="verify-code" maxLength={6} pattern={REGEXP_ONLY_DIGITS} value={otp} onChange={setOtp} onComplete={verify} disabled={pending} aria-label="Six-digit verification code" containerClassName="mt-2">
            <InputOTPGroup className="gap-2">{Array.from({ length: 6 }, (_, index) => <InputOTPSlot key={index} index={index} className="rounded-lg! border!" />)}</InputOTPGroup>
          </InputOTP>
          {error && <p role="alert" className="mt-4 text-center text-sm text-destructive">{error}</p>}
          {pending && <p role="status" className="mt-4 text-sm text-muted-foreground">Please wait…</p>}
          <Button type="button" className="mt-6 w-full" onClick={resend} disabled={pending || cooldown > 0}>{cooldown > 0 ? `Resend code in ${Math.floor(cooldown / 60)}:${String(cooldown % 60).padStart(2, "0")}` : "Resend code"}</Button>
          <Button type="button" variant="secondary" className="mt-3 w-full" onClick={() => router.replace("/signup")} disabled={pending}>Previous step</Button>
          <Link href="/login" replace className="mt-8 text-sm underline-offset-4 hover:underline">Back to login</Link>
        </div>}
      </div>
    </main>
  )
}
