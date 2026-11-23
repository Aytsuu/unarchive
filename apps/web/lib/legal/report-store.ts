import { ObjectId, type Db } from "mongodb"
import type { ContentReportInput, ReportCategory } from "./reports.ts"

export type ContentReportRecord = {
  _id?: ObjectId
  category: ReportCategory
  details: string
  projectId?: string
  contactEmail?: string
  userId?: string
  status: "open" | "reviewing" | "resolved" | "rejected"
  resolution?: string
  createdAt: Date
  updatedAt: Date
}

const indexPromises = new WeakMap<Db, Promise<void>>()

async function ensureIndexes(db: Db) {
  let pending = indexPromises.get(db)
  if (!pending) {
    const collection = db.collection<ContentReportRecord>("contentReports")
    pending = Promise.all([
      collection.createIndex({ createdAt: -1 }),
      collection.createIndex({ status: 1, createdAt: -1 }),
      collection.createIndex({ projectId: 1, createdAt: -1 }),
    ]).then(() => undefined).catch((error: unknown) => {
      indexPromises.delete(db)
      throw error
    })
    indexPromises.set(db, pending)
  }
  await pending
}

export async function createContentReport(db: Db, input: ContentReportInput & { userId?: string }) {
  await ensureIndexes(db)
  const now = new Date()
  const document: ContentReportRecord = {
    category: input.category,
    details: input.details,
    status: "open",
    createdAt: now,
    updatedAt: now,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.contactEmail ? { contactEmail: input.contactEmail } : {}),
    ...(input.userId ? { userId: input.userId } : {}),
  }
  const result = await db.collection<ContentReportRecord>("contentReports").insertOne(document)
  return { id: result.insertedId.toHexString() }
}

export async function listContentReports(db: Db) {
  await ensureIndexes(db)
  const reports = await db.collection<ContentReportRecord>("contentReports").find({}, { sort: { createdAt: -1 }, limit: 100 }).toArray()
  return reports.map((report) => ({
    id: report._id?.toHexString() ?? "",
    category: report.category,
    details: report.details,
    projectId: report.projectId ?? null,
    status: report.status,
    resolution: report.resolution ?? null,
    createdAt: report.createdAt.toISOString(),
  }))
}

export async function updateContentReport(db: Db, id: string, update: { status: ContentReportRecord["status"]; resolution?: string }) {
  await ensureIndexes(db)
  if (!/^[a-f\d]{24}$/i.test(id)) return null
  const result = await db.collection<ContentReportRecord>("contentReports").findOneAndUpdate(
    { _id: new ObjectId(id) },
    { $set: { status: update.status, updatedAt: new Date(), ...(update.resolution ? { resolution: update.resolution } : {}) } },
    { returnDocument: "after" },
  )
  return result
}
