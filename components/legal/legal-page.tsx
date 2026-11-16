import Link from "next/link"
import { BrandLogo } from "@/components/brand/brand-logo"
import { LegalDocumentView } from "@/components/legal/legal-document"
import type { LegalDocumentContent } from "@/lib/legal/policy"

export function LegalPage({ document }: { document: LegalDocumentContent }) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="flex items-center justify-between gap-4 px-5 pt-6 sm:px-10">
        <Link href="/home" className="text-xl font-medium"><BrandLogo /></Link>
        <nav aria-label="Legal documents" className="flex gap-4 text-sm">
          <Link href="/terms" className="underline-offset-4 hover:underline">Terms</Link>
          <Link href="/privacy" className="underline-offset-4 hover:underline">Privacy</Link>
          <Link href="/contact" className="underline-offset-4 hover:underline">Contact</Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12">
        <LegalDocumentView document={document} />
      </main>
    </div>
  )
}
