import { PROJECT_TOPICS } from "../project-topics.mjs"

export type ProjectInput = {
  title: string
  description: string
  abstract?: string
  institution: string
  dateStarted?: string
  dateEnded?: string
  topics?: string[]
  referenceProjectIds?: string[]
  links: string[]
  contributors: string[]
  consents: { permission: true; contributorsPermission: true; detailsAccurate: true; universityIp: true }
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

function referenceIds(value: unknown): string[] {
  if (value === undefined) return []
  if (!Array.isArray(value) || value.length > 20 || value.some((id) => typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id))) {
    throw new ProjectValidationError("Choose up to 20 valid reference projects.")
  }
  return [...new Set(value.map((id: string) => id.toLowerCase()))]
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
  const topics = textList(data.topics, "Topics", PROJECT_TOPICS.length, 200)
  if (topics.some((topic) => !PROJECT_TOPICS.includes(topic))) throw new ProjectValidationError("Choose valid topics.")
  const uniqueTopics = [...new Set(topics)]
  const referenceProjectIds = referenceIds(data.referenceProjectIds)
  for (const link of links) {
    let parsed: URL
    try { parsed = new URL(link) } catch { throw new ProjectValidationError("Links must be valid HTTP or HTTPS URLs.") }
    if (!(["http:", "https:"].includes(parsed.protocol)) || parsed.username || parsed.password) {
      throw new ProjectValidationError("Links must be valid HTTP or HTTPS URLs without credentials.")
    }
  }
  const consents = data.consents
  if (!consents || typeof consents !== "object" || Array.isArray(consents) || !("permission" in consents) || !("contributorsPermission" in consents) || !("detailsAccurate" in consents) || !("universityIp" in consents) || consents.permission !== true || consents.contributorsPermission !== true || consents.detailsAccurate !== true || consents.universityIp !== true) {
    throw new ProjectValidationError("Please confirm all consents before publishing.")
  }
  return { title, description, institution, links, contributors, consents: { permission: true, contributorsPermission: true, detailsAccurate: true, universityIp: true }, ...(abstract ? { abstract } : {}), ...(dateStarted ? { dateStarted } : {}), ...(dateEnded ? { dateEnded } : {}), ...(uniqueTopics.length ? { topics: uniqueTopics } : {}), ...(referenceProjectIds.length ? { referenceProjectIds } : {}) }
}
