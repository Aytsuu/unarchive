import { Suspense } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { SessionCheck } from "@/components/auth/session-check"

async function LoginContent({ searchParams }: PageProps<"/login">) {
  const query = await searchParams
  const oauthError = typeof query.error === "string" ? query.error : typeof query.oauth_error === "string" ? query.oauth_error : undefined
  return <SessionCheck><LoginForm oauthError={oauthError} verified={query.verified === "1"} /></SessionCheck>
}

export default function LoginPage(props: PageProps<"/login">) {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><LoginContent {...props} /></Suspense>
}
