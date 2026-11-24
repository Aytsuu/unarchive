import { Suspense } from "react"
import { LoginForm } from "@/components/auth/login-form"
import { SessionCheck } from "@/components/auth/session-check"
import { moderatorAppUrl, safeModeratorReturn } from "@unarchive/domain/return-url"

async function LoginContent({ searchParams }: PageProps<"/login">) {
  const query = await searchParams
  const oauthError = typeof query.error === "string" ? query.error : typeof query.oauth_error === "string" ? query.oauth_error : undefined
  const returnTo = safeModeratorReturn(typeof query.next === "string" ? query.next : "", moderatorAppUrl()) ?? undefined
  return <SessionCheck returnTo={returnTo}><LoginForm oauthError={oauthError} verified={query.verified === "1"} returnTo={returnTo} /></SessionCheck>
}

export default function LoginPage(props: PageProps<"/login">) {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><LoginContent {...props} /></Suspense>
}
