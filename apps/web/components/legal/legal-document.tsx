import type { LegalDocumentContent } from "@/lib/legal/policy"

function formatEffectiveDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return value
  const date = new Date(`${value}T00:00:00Z`)
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date)
}

export function LegalDocumentView({ document, headingId, showTitle = true }: { document: LegalDocumentContent; headingId?: string; showTitle?: boolean }) {
  return (
    <article className="space-y-8">
      {showTitle ? (
        <header className="space-y-2">
          <h1 id={headingId} className="text-2xl font-medium">{document.title}</h1>
          <p className="text-sm text-muted-foreground">Version {document.version} · Effective {formatEffectiveDate(document.effectiveAt)}</p>
        </header>
      ) : null}
      {document.sections.map((section) => (
        <section key={section.id} className="space-y-3" aria-labelledby={`${document.type}-${section.id}`}>
          <h2 id={`${document.type}-${section.id}`} className="text-lg font-medium">{section.title}</h2>
          {section.paragraphs.map((paragraph, index) => <p key={`${section.id}-${index}`} className="text-sm leading-6 text-foreground/90">{paragraph}</p>)}
        </section>
      ))}
    </article>
  )
}
