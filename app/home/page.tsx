import { headers } from "next/headers"
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { HomeScreen } from "@/components/home/home-screen"

async function HomeContent() {
  const session = await auth.api.getSession({ headers: await headers() })
  return <HomeScreen user={session?.user ? { name: session.user.name, email: session.user.email, image: session.user.image } : null} />
}

export default function HomePage() {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><HomeContent /></Suspense>
}
