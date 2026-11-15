import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import { BrandLogo } from "@/components/brand/brand-logo"
import { ContentReportForm } from "@/components/legal/content-report-form"
import { SiteFooter } from "@/components/legal/site-footer"
import { auth } from "@/lib/auth"
import { legalContactEmail } from "@/lib/legal/admin"

export const metadata: Metadata = {
  title: "Contact / Report Content · Unarchive",
  description: "Contact Unarchive about copyright, privacy, authorship, or other content concerns.",
}

export default async function ContactPage() {
  const session = await auth.api.getSession({ headers: await headers() })
  const contactEmail = legalContactEmail()
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 px-5 pt-6 sm:px-10">
        <Link href="/home" className="text-xl font-medium"><BrandLogo /></Link>
        <Link href="/home" className="text-sm text-muted-foreground hover:text-foreground">Home</Link>
      </header>
      <main className="mx-auto w-full max-w-xl flex-1 px-5 py-12">
        <h1 className="text-2xl font-medium">Contact / Report Content</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Use this form for copyright complaints, authorship or contributor corrections, confidential materials, privacy requests, or other policy concerns.
          {contactEmail ? <> You can also email {contactEmail}.</> : null}
        </p>
        <div className="mt-8"><ContentReportForm signedIn={Boolean(session)} /></div>
      </main>
      <SiteFooter />
    </div>
  )
}
