import { ObjectId, type ClientSession, type Db, type MongoClient } from "mongodb"
import type { ProjectInput } from "./validation"

export class ProjectVersionConflictError extends Error {
  constructor() { super("The project changed. Reload it before saving."); this.name = "ProjectVersionConflictError" }
}
export class ProjectNotFoundError extends Error {
  constructor() { super("Project not found."); this.name = "ProjectNotFoundError" }
}
export class ProjectIdempotencyConflictError extends Error {
  constructor() { super("This edit key was already used for different content."); this.name = "ProjectIdempotencyConflictError" }
}
export class ProjectVersionConsistencyError extends Error {
  constructor() { super("Project version history is inconsistent."); this.name = "ProjectVersionConsistencyError" }
}
export class ProjectReferenceNotFoundError extends Error {
  constructor() { super("One or more reference projects no longer exist."); this.name = "ProjectReferenceNotFoundError" }
}

export type VersionableProject = Partial<ProjectInput> & {
  _id: ObjectId
  ownerId: string
  title: string
  demos?: string[]
  createdAt?: Date
  updatedAt?: Date
  currentVersion?: number | null
  withdrawnAt?: Date
  idempotencyDigest?: string
}
export type ProjectSnapshot = {
  title: string
  description?: string
  abstract?: string
  institution?: string
  dateStarted?: string
  dateEnded?: string
  projectType?: string
  topics?: string[]
  referenceProjectIds?: string[]
  references?: { id: string; title: string }[]
  contributors?: string[]
  links?: string[]
  demos: string[]
  createdAt?: Date
}
export type ProjectVersion = {
  projectId: ObjectId
  version: number
  kind: "published" | "revision" | "legacy"
  capturedAt: Date
  snapshot: ProjectSnapshot
  editKey?: string
  editDigest?: string
}

const publicFields = ["title", "description", "abstract", "institution", "dateStarted", "dateEnded", "projectType", "topics", "referenceProjectIds", "contributors", "links", "demos", "createdAt"] as const
const mutableFields = ["title", "description", "abstract", "institution", "dateStarted", "dateEnded", "projectType", "topics", "referenceProjectIds", "contributors", "links", "demos"] as const
const optionalFields = ["abstract", "dateStarted", "dateEnded", "topics", "referenceProjectIds"] as const
const indexPromises = new WeakMap<Db, Promise<void>>()
const transactionOptions = { readConcern: { level: "snapshot" as const }, writeConcern: { w: "majority" as const } }

export function projectSnapshot(project: VersionableProject): ProjectSnapshot {
  if (typeof project.title !== "string" || !project.title.trim()) throw new ProjectVersionConsistencyError()
  for (const key of ["topics", "referenceProjectIds", "contributors", "links", "demos"] as const) {
    const values = project[key]
    if (values != null && (!Array.isArray(values) || values.some((value) => typeof value !== "string"))) throw new ProjectVersionConsistencyError()
  }
  const result: Record<string, unknown> = {}
  for (const key of publicFields) {
    const value = project[key]
    if (value !== undefined && value !== null) result[key] = Array.isArray(value) ? [...value] : value instanceof Date ? new Date(value) : value
  }
  if (!Array.isArray(result.demos)) result.demos = []
  return result as ProjectSnapshot
}

async function snapshotWithReferences(db: Db, project: VersionableProject, session: ClientSession, strict: boolean): Promise<ProjectSnapshot> {
  const snapshot = projectSnapshot(project)
  if (!snapshot.referenceProjectIds?.length) return snapshot
  const validIds = snapshot.referenceProjectIds.filter((id) => /^[a-f\d]{24}$/i.test(id))
  if (strict && validIds.length !== snapshot.referenceProjectIds.length) throw new ProjectReferenceNotFoundError()
  const matches = await db.collection<VersionableProject>("projects").find({ _id: { $in: validIds.map((id) => new ObjectId(id)) }, withdrawnAt: { $exists: false } }, { projection: { title: 1 }, session }).toArray()
  const names = new Map(matches.map((item) => [item._id.toHexString(), item.title]))
  snapshot.references = validIds.flatMap((id) => {
    const title = names.get(id.toLowerCase())
    return typeof title === "string" ? [{ id: id.toLowerCase(), title }] : []
  })
  if (strict && snapshot.references.length !== snapshot.referenceProjectIds.length) throw new ProjectReferenceNotFoundError()
  return snapshot
}

export async function ensureProjectVersionIndexes(db: Db): Promise<void> {
  let pending = indexPromises.get(db)
  if (!pending) {
    const versions = db.collection<ProjectVersion>("projectVersions")
    pending = Promise.all([
      versions.createIndex({ projectId: 1, version: 1 }, { unique: true, name: "project_version_unique" }),
      versions.createIndex({ projectId: 1, editKey: 1 }, { unique: true, partialFilterExpression: { editKey: { $type: "string" } }, name: "project_edit_key_unique" }),
    ]).then(() => undefined).catch((error: unknown) => { indexPromises.delete(db); throw error })
    indexPromises.set(db, pending)
  }
  await pending
}

export async function createInitialVersionedProject(client: MongoClient, db: Db, document: VersionableProject): Promise<void> {
  await ensureProjectVersionIndexes(db)
  const capturedAt = new Date()
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      const snapshot = await snapshotWithReferences(db, document, session, true)
      await db.collection<VersionableProject>("projects").insertOne({ ...document, currentVersion: 1 }, { session })
      await db.collection<ProjectVersion>("projectVersions").insertOne({ projectId: document._id, version: 1, kind: "published", capturedAt, snapshot }, { session })
    }, transactionOptions)
  } finally { await session.endSession() }
}

export async function captureLegacyBaseline(client: MongoClient, db: Db, projectId: ObjectId): Promise<{ version: number; created: boolean }> {
  await ensureProjectVersionIndexes(db)
  const capturedAt = new Date()
  const session = client.startSession()
  try {
    const result = await session.withTransaction(async () => {
      const projects = db.collection<VersionableProject>("projects")
      const versions = db.collection<ProjectVersion>("projectVersions")
      const project = await projects.findOne({ _id: projectId, withdrawnAt: { $exists: false } }, { session })
      if (!project) throw new ProjectNotFoundError()
      if (typeof project.currentVersion === "number" && Number.isSafeInteger(project.currentVersion) && project.currentVersion >= 1) {
        if (!await versions.findOne({ projectId, version: project.currentVersion }, { session, projection: { _id: 1 } })) throw new ProjectVersionConsistencyError()
        return { version: project.currentVersion, created: false }
      }
      if (project.currentVersion != null || await versions.findOne({ projectId }, { session, projection: { _id: 1 } })) throw new ProjectVersionConsistencyError()
      const snapshot = await snapshotWithReferences(db, project, session, false)
      const update = await projects.updateOne({ _id: projectId, currentVersion: null, withdrawnAt: { $exists: false } }, { $set: { currentVersion: 1 } }, { session })
      if (update.matchedCount !== 1) throw new ProjectVersionConflictError()
      await versions.insertOne({ projectId, version: 1, kind: "legacy", capturedAt, snapshot }, { session })
      return { version: 1, created: true }
    }, transactionOptions)
    if (!result) throw new ProjectVersionConsistencyError()
    return result
  } finally { await session.endSession() }
}

export async function createProjectVersion(client: MongoClient, db: Db, args: { projectId: ObjectId; ownerId: string; expectedVersion: number; project: ProjectInput; demos: string[]; editKey: string; editDigest: string }): Promise<{ version: number; replayed: boolean }> {
  await ensureProjectVersionIndexes(db)
  if (!Number.isSafeInteger(args.expectedVersion) || args.expectedVersion < 1 || !args.editKey || !args.editDigest) throw new ProjectVersionConflictError()
  const capturedAt = new Date()
  const session = client.startSession()
  try {
    const result = await session.withTransaction(async () => {
      const projects = db.collection<VersionableProject>("projects")
      const versions = db.collection<ProjectVersion>("projectVersions")
      const current = await projects.findOne({ _id: args.projectId, ownerId: args.ownerId, withdrawnAt: { $exists: false } }, { session })
      if (!current) throw new ProjectNotFoundError()
      const previousEdit = await versions.findOne({ projectId: args.projectId, editKey: args.editKey }, { session })
      if (previousEdit) {
        if (previousEdit.editDigest !== args.editDigest) throw new ProjectIdempotencyConflictError()
        return { version: previousEdit.version, replayed: true }
      }
      if (current.currentVersion !== args.expectedVersion) throw new ProjectVersionConflictError()
      const values = { ...args.project, demos: [...args.demos] }
      const set: Record<string, unknown> = { currentVersion: args.expectedVersion + 1, updatedAt: capturedAt }
      for (const key of mutableFields) if (values[key] !== undefined) set[key] = values[key]
      const unset: Record<string, ""> = {}
      for (const key of optionalFields) if (values[key] === undefined) unset[key] = ""
      const cleared = Object.fromEntries(optionalFields.map((key) => [key, values[key]]))
      const next = { ...current, ...cleared, ...values, _id: current._id, ownerId: current.ownerId, createdAt: current.createdAt }
      const snapshot = await snapshotWithReferences(db, next, session, true)
      const update = await projects.updateOne({ _id: args.projectId, ownerId: args.ownerId, currentVersion: args.expectedVersion, withdrawnAt: { $exists: false } }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}) }, { session })
      if (update.matchedCount !== 1) throw new ProjectVersionConflictError()
      const version = args.expectedVersion + 1
      await versions.insertOne({ projectId: args.projectId, version, kind: "revision", capturedAt, snapshot, editKey: args.editKey, editDigest: args.editDigest }, { session })
      return { version, replayed: false }
    }, transactionOptions)
    if (!result) throw new ProjectVersionConsistencyError()
    return result
  } finally { await session.endSession() }
}
