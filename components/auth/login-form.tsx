"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, type FormEvent } from "react"
import { BrandLogo } from "@/components/brand/brand-logo"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { authClient } from "@/lib/auth-client"

export function LoginForm({ oauthError, verified }: { oauthError?: string; verified: boolean }) {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(oauthError === "signup_disabled"
    ? "This google account is not registered"
    : oauthError === "account_not_linked"
      ? "Google could not be linked to this account. Verify the account email, then try again or sign in with your existing credentials."
      : oauthError ? "Google sign-in was cancelled or could not be completed. Please try again." : "")
  const [showVerification, setShowVerification] = useState(false)

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError("")
    setShowVerification(false)
    setPending(true)
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password })
      if (result.error) {
        if (result.error.code === "EMAIL_NOT_VERIFIED") {
          setError("Please verify your email before signing in.")
          setShowVerification(true)
        } else {
          setError(result.error.status === 429 ? "Too many attempts. Please wait and try again." : "Unable to sign in. Check your credentials and try again.")
        }
        return
      }
      setPassword("")
      router.replace("/home")
      router.refresh()
    } catch {
      setError("Unable to sign in right now. Please try again.")
    } finally {
      setPending(false)
    }
  }

  async function signInWithGoogle() {
    setError("")
    setPending(true)
    try {
      const result = await authClient.signIn.social({ provider: "google", callbackURL: "/home", errorCallbackURL: "/login?oauth_error=1", disableRedirect: true })
      const authorizationUrl = result.data?.url ? new URL(result.data.url) : null
      if (result.error || authorizationUrl?.protocol !== "https:" || authorizationUrl.hostname !== "accounts.google.com") {
        setError("Google sign-in could not be started. Please try again.")
      } else {
        window.location.replace(authorizationUrl.href)
      }
    } catch {
      setError("Google sign-in could not be started. Please try again.")
    } finally {
      setPending(false)
    }
  }

  function openVerification() {
    try { sessionStorage.setItem("verification-email", email.trim()) } catch {
      setError("Your browser could not save verification details. Enable session storage and try again.")
      return
    }
    router.replace("/verify-email")
  }

  return (
    <main className="flex min-h-dvh flex-col items-center bg-background px-5 pb-12 pt-20 text-foreground sm:pt-53">
      <h1 className="text-xl font-medium leading-6"><BrandLogo /></h1>
      <div className="mt-12.75 w-full max-w-60">
        {verified && <p role="status" className="mb-4 text-sm text-muted-foreground">Email verified. You can now sign in.</p>}
        <Button type="button" variant="outline" className="w-full" onClick={signInWithGoogle} disabled={pending}>Continue with Google</Button>
        <div className="my-6 flex items-center gap-3 text-muted-foreground">
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
          <span className="font-mono text-xs">OR</span>
          <span aria-hidden="true" className="h-px flex-1 bg-border" />
        </div>
        <form onSubmit={signIn}>
          <div className="space-y-3.75">
            <div className="space-y-2"><Label htmlFor="login-email">Email</Label><Input id="login-email" name="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Enter text" className="text-sm" /></div>
            <div className="space-y-2"><Label htmlFor="login-password">Password</Label><Input id="login-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter text" className="text-sm" /></div>
          </div>
          {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
          {showVerification && <Button type="button" variant="link" className="mt-2 h-auto px-0" onClick={openVerification}>Resend verification code</Button>}
          <Button type="submit" className="mt-10 w-full" disabled={pending}>{pending ? "Please wait…" : "Next"}</Button>
        </form>
      </div>
      <p className="mt-11.75 text-center text-sm font-medium leading-[normal]">By continuing, you agree to our<br />Terms of Service and Privacy Policy.</p>
      <p className="mt-12.5 text-sm font-medium">Need an account?{"  "}<Link href="/signup" replace className="focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Sign up</Link></p>
    </main>
  )
}
