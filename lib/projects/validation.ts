export type ProjectInput = {
  title: string
  description: string
  abstract?: string
  institution: string
  dateStarted?: string
  dateEnded?: string
  links: string[]
  contributors: string[]
  consents: { permission: true; contributorsPermission: true }
}

export class ProjectValidationError extends Error {}

function textValue(value: unknown, name: string, max: number, required = false): string {
  if (value === undefined && !required) return ""
  if (typeof value !== "string") throw new ProjectValidationError(`${name} must be text.`)
  const result = value.trim()
  if ((required && !result) || result.length > max) throw new ProjectValidationError(`${name} must be ${required ? "between 1 and" : "at most"} ${max} characters.`)
  return result
}

function textList(value: unknown, name: string, maxCount: number, maxLength: number): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > maxCount) throw new ProjectValidationError(`${name} must have at most ${maxCount} entries.`)
  return value.map((item) => textValue(item, name, maxLength)).filter(Boolean)
}

function projectMonth(value: unknown, name: string): string {
  const result = textValue(value, name, 7)
  if (result && (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(result) || result.startsWith("0000-"))) {
    throw new ProjectValidationError(`${name} must be a valid month and year.`)
  }
  return result
}

export function parseProject(value: unknown): ProjectInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ProjectValidationError("Invalid project details.")
  const data = value as Record<string, unknown>
  const title = textValue(data.title, "Title", 200, true)
  const description = textValue(data.description, "Description", 5000)
  const abstract = textValue(data.abstract, "Abstract", 10000)
  const institution = textValue(data.institution, "Institution", 200)
  const dateStarted = projectMonth(data.dateStarted, "Date started")
  const dateEnded = projectMonth(data.dateEnded, "Date ended")
  if (dateStarted && dateEnded && dateEnded < dateStarted) throw new ProjectValidationError("Date ended cannot be before date started.")
  const links = textList(data.links, "Links", 20, 2048)
  const contributors = textList(data.contributors, "Contributors", 50, 200)
  for (const link of links) {
    let parsed: URL
    try { parsed = new URL(link) } catch { throw new ProjectValidationError("Links must be valid HTTP or HTTPS URLs.") }
    if (!(["http:", "https:"].includes(parsed.protocol)) || parsed.username || parsed.password) {
      throw new ProjectValidationError("Links must be valid HTTP or HTTPS URLs without credentials.")
    }
  }
  const consents = data.consents
  if (!consents || typeof consents !== "object" || Array.isArray(consents) || !("permission" in consents) || !("contributorsPermission" in consents) || consents.permission !== true || consents.contributorsPermission !== true) {
    throw new ProjectValidationError("Please confirm both consents before publishing.")
  }
  return { title, description, institution, links, contributors, consents: { permission: true, contributorsPermission: true }, ...(abstract ? { abstract } : {}), ...(dateStarted ? { dateStarted } : {}), ...(dateEnded ? { dateEnded } : {}) }
}
