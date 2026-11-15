import Link from "next/link"

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border px-5 py-6 text-sm text-muted-foreground">
      <nav aria-label="Legal" className="mx-auto flex w-full max-w-341.5 flex-wrap items-center justify-center gap-x-5 gap-y-2">
        <Link href="/terms" className="underline-offset-4 hover:text-foreground hover:underline">Terms & Conditions</Link>
        <Link href="/privacy" className="underline-offset-4 hover:text-foreground hover:underline">Privacy Policy</Link>
        <Link href="/contact" className="underline-offset-4 hover:text-foreground hover:underline">Contact / Report Content</Link>
      </nav>
    </footer>
  )
}
