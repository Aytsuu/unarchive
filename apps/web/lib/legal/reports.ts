export const REPORT_CATEGORIES = ["copyright", "authorship", "contributor", "confidential", "privacy", "policy"] as const
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]
export type ContentReportInput = {
  category: ReportCategory
  details: string
  projectId?: string
  contactEmail?: string
}

export class ReportValidationError extends Error {}

function textValue(value: unknown, name: string, max: number) {
  if (typeof value !== "string") throw new ReportValidationError(`${name} must be text.`)
  const result = value.trim()
  if (!result || result.length > max) throw new ReportValidationError(`${name} must be between 1 and ${max} characters.`)
  return result
}

export function parseContentReport(value: unknown): ContentReportInput {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ReportValidationError("Invalid report details.")
  const data = value as Record<string, unknown>
  if (typeof data.category !== "string" || !REPORT_CATEGORIES.includes(data.category as ReportCategory)) {
    throw new ReportValidationError("Choose a valid report category.")
  }
  const details = textValue(data.details, "Details", 5000)
  const result: ContentReportInput = { category: data.category as ReportCategory, details }
  if (data.projectId !== undefined && data.projectId !== "") {
    if (typeof data.projectId !== "string" || !/^[a-f\d]{24}$/i.test(data.projectId)) throw new ReportValidationError("Choose a valid project.")
    result.projectId = data.projectId.toLowerCase()
  }
  if (data.contactEmail !== undefined && data.contactEmail !== "") {
    const contactEmail = textValue(data.contactEmail, "Email", 254).toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) throw new ReportValidationError("Enter a valid email address.")
    result.contactEmail = contactEmail
  }
  return result
}
