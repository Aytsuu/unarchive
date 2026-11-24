export class InvalidProjectEditError extends Error {}

export function parseEditKey(key) {
  if (typeof key !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) throw new InvalidProjectEditError("Idempotency-Key must be a UUID.")
  return key.toLowerCase()
}

export function parseEditPayload(value, parseProject) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new InvalidProjectEditError("Invalid edit details.")
  if (!Number.isSafeInteger(value.expectedVersion) || value.expectedVersion < 1) throw new InvalidProjectEditError("A valid current version is required.")
  if (!value.project || typeof value.project !== "object" || Array.isArray(value.project)) throw new InvalidProjectEditError("Invalid project details.")
  // parseProject validates public fields. Historical consents are never taken from
  // this object or changed by an edit; the version writer retains stored consents.
  const project = parseProject({ ...value.project, consents: { permission: true, contributorsPermission: true, detailsAccurate: true, universityIp: true } })
  return { expectedVersion: value.expectedVersion, project }
}
