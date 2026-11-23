import { headers } from "next/headers"
import { connection } from "next/server"
import { cache } from "react"
import { Suspense } from "react"
import { auth } from "@/lib/auth"
import { getProjectListing } from "@/lib/projects/listing"
import { LandingAccountNav, LandingGetStarted, LandingPage, LandingPreviewCards } from "@/components/landing/landing-page"

const signedIn = cache(async () => {
  await connection()
  const session = await auth.api.getSession({ headers: await headers() })
  return Boolean(session)
})

async function SessionAccount() {
  return <LandingAccountNav signedIn={await signedIn()} />
}

async function SessionGetStarted() {
  return <LandingGetStarted signedIn={await signedIn()} />
}

async function LivePreviews() {
  const listing = await getProjectListing("", 1, 3)
  return <LandingPreviewCards projects={listing.projects} />
}

export default function Home() {
  return (
    <LandingPage
      account={<Suspense fallback={<LandingAccountNav signedIn={false} />}><SessionAccount /></Suspense>}
      previews={<Suspense fallback={<LandingPreviewCards projects={[]} />}><LivePreviews /></Suspense>}
      getStarted={<Suspense fallback={<LandingGetStarted signedIn={false} />}><SessionGetStarted /></Suspense>}
    />
  )
}
