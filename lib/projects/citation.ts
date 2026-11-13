export type CitationInput = {
  title: string
  authors: string[]
  completionYear: string
  institution: string
  projectType?: string
  url?: string
  version?: number
}

export type CitationResult =
  | { ok: true; beforeTitle: string; title: string; afterTitle: string; text: string }
  | { ok: false; missing: string[] }

function authorList(authors: string[]): string {
  if (authors.length === 1) return authors[0]
  if (authors.length === 2) return `${authors[0]}, & ${authors[1]}`
  if (authors.length > 20) return `${authors.slice(0, 19).join(", ")}, … ${authors.at(-1)}`
  return `${authors.slice(0, -1).join(", ")}, & ${authors.at(-1)}`
}

function publicUrl(value: string): string | null {
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password ? url.href : null
  } catch {
    return null
  }
}

export function isLocalDevelopmentUrl(value: string): boolean {
  try {
    const host = new URL(value).hostname.toLowerCase()
    return host === "localhost" || host.endsWith(".localhost") || host === "[::1]" || host === "0.0.0.0" || /^127(?:\.\d{1,3}){3}$/.test(host)
  } catch {
    return false
  }
}

export function createCitation(input: CitationInput): CitationResult {
  const title = input.title.trim()
  const authors = input.authors.map((author) => author.trim()).filter(Boolean)
  const year = input.completionYear.trim()
  const institution = input.institution.trim()
  const projectType = input.projectType?.trim() ?? ""
  const url = publicUrl(input.url?.trim() ?? "")
  const missing: string[] = []
  if (!title) missing.push("title")
  if (!authors.length) missing.push("authors")
  if (!/^(?!0000)\d{4}$/.test(year)) missing.push("completion year")
  if (!institution) missing.push("institution")
  if (missing.length) return { ok: false, missing }
  const beforeTitle = `${authorList(authors)} (${year}). `
  const version = Number.isSafeInteger(input.version) && input.version! > 0 ? ` (Version ${input.version})` : ""
  const description = projectType ? ` [${projectType}, ${institution}].` : `. ${institution}.`
  const afterTitle = `${version}${description} Unarchive.${url ? ` ${url}` : ""}`
  return { ok: true, beforeTitle, title, afterTitle, text: `${beforeTitle}${title}${afterTitle}` }
}
