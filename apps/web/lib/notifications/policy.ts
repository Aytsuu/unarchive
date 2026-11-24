export const REFERENCE_GROUP_WINDOW_MS = 24 * 60 * 60 * 1000
export const NOTIFICATION_RETENTION_MS = 90 * 24 * 60 * 60 * 1000
export const NOTIFICATION_PAGE_SIZE = 20

const objectId = /^[a-f\d]{24}$/

export function normalizeReferenceIds(ids: readonly string[] | undefined): string[] {
  const seen = new Set<string>()
  const result: string[] = []
  for (const id of ids ?? []) {
    const normalized = id.toLowerCase()
    if (!objectId.test(normalized) || seen.has(normalized)) continue
    seen.add(normalized)
    result.push(normalized)
  }
  return result
}

export function addedReferenceIds(previous: readonly string[] | undefined, next: readonly string[] | undefined): string[] {
  const before = new Set(normalizeReferenceIds(previous))
  return normalizeReferenceIds(next).filter((id) => !before.has(id))
}

export function referenceEventId(projectId: string, version: number, referencedProjectId: string): string {
  return `project.referenced:${projectId.toLowerCase()}:${version}:${referencedProjectId.toLowerCase()}`
}

export function referenceGroupKey(recipientId: string, referencedProjectId: string): string {
  return `project.referenced:${recipientId}:${referencedProjectId.toLowerCase()}`
}

export function belongsToReferenceGroup(lastOccurredAt: Date, occurredAt: Date): boolean {
  return Math.abs(occurredAt.getTime() - lastOccurredAt.getTime()) <= REFERENCE_GROUP_WINDOW_MS
}

export function starEventId(projectId: string, actorId: string, occurredAt: Date): string {
  return `project.starred:${projectId.toLowerCase()}:${actorId}:${occurredAt.toISOString()}`
}

export function starGroupKey(recipientId: string, starredProjectId: string): string {
  return `project.starred:${recipientId}:${starredProjectId.toLowerCase()}`
}

export function notificationExpiry(occurredAt: Date): Date {
  return new Date(occurredAt.getTime() + NOTIFICATION_RETENTION_MS)
}

export type EmailPreferenceKey = "projectReferences" | "projectStars" | "productAnnouncements" | "whatsNew" | "publishApproved" | "revisionRequested"

export const defaultEmailPreferences: Record<EmailPreferenceKey, boolean> = {
  projectReferences: false,
  projectStars: false,
  productAnnouncements: false,
  whatsNew: false,
  publishApproved: true,
  revisionRequested: true,
}
