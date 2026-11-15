import { differenceInCalendarDays, startOfDay } from "date-fns"
import { ObjectId, type Db } from "mongodb"

type SaveRecord = { _id?: ObjectId; projectId: ObjectId; userId: string; createdAt: Date }
type SavedRow = {
  _id: ObjectId
  projectId: ObjectId
  createdAt: Date
  project: { title: string; description?: string; topics?: string[]; ownerId: string }
}

export type SavedProjectListItem = {
  id: string
  title: string
  description: string
  topics: string[]
  publisher: string
  savedAt: string
  savedLabel: string
}

function formatSavedDate(savedAt: Date) {
  const month = String(savedAt.getMonth() + 1).padStart(2, "0")
  const day = String(savedAt.getDate()).padStart(2, "0")
  return `${month}/${day}/${savedAt.getFullYear()}`
}

export function formatSavedLabel(savedAt: Date, now = new Date()) {
  const days = differenceInCalendarDays(startOfDay(now), startOfDay(savedAt))
  if (days === 0) return "Saved today"
  if (days === 1) return "Saved yesterday"
  if (savedAt.getFullYear() === now.getFullYear()) {
    const month = savedAt.toLocaleDateString("en-US", { month: "short" })
    return `Saved on ${month} ${savedAt.getDate()}`
  }
  return formatSavedDate(savedAt)
}
const indexPromises = new WeakMap<Db, Promise<void>>()
const PAGE_SIZE = 50

async function ensureIndexes(db: Db) {
  let pending = indexPromises.get(db)
  if (!pending) {
    const collection = db.collection<SaveRecord>("projectSaves")
    pending = Promise.all([
      collection.createIndex({ userId: 1, projectId: 1 }, { unique: true }),
      collection.createIndex({ userId: 1, _id: -1 }),
    ]).then(() => undefined).catch((error: unknown) => { indexPromises.delete(db); throw error })
    indexPromises.set(db, pending)
  }
  await pending
}

export async function getProjectSaved(db: Db, projectId: ObjectId, userId: string) {
  return (await db.collection<SaveRecord>("projectSaves").findOne({ projectId, userId }, { projection: { _id: 1 }, maxTimeMS: 3000 })) !== null
}

export async function getSavedProjectIds(db: Db, projectIds: ObjectId[], userId: string) {
  if (!projectIds.length) return new Set<string>()
  const records = await db.collection<SaveRecord>("projectSaves").find({ userId, projectId: { $in: projectIds } }, { projection: { projectId: 1 }, maxTimeMS: 3000 }).toArray()
  return new Set(records.map((record) => record.projectId.toHexString()))
}

export async function setProjectSaved(db: Db, projectId: ObjectId, userId: string, saved: boolean) {
  await ensureIndexes(db)
  const collection = db.collection<SaveRecord>("projectSaves")
  if (saved) {
    try { await collection.insertOne({ projectId, userId, createdAt: new Date() }) } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error
    }
  } else {
    await collection.deleteOne({ projectId, userId })
  }
  return { saved: await getProjectSaved(db, projectId, userId) }
}

export async function listSavedProjects(db: Db, userId: string, cursor: string | null) {
  const records = await db.collection<SaveRecord>("projectSaves").aggregate<SavedRow>([
    { $match: { userId, ...(cursor ? { _id: { $lt: new ObjectId(cursor) } } : {}) } },
    { $sort: { _id: -1 } },
    { $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "project" } },
    { $unwind: "$project" },
    { $match: { "project.withdrawnAt": { $exists: false } } },
    { $limit: PAGE_SIZE + 1 },
    { $project: { projectId: 1, createdAt: 1, "project.title": 1, "project.description": 1, "project.topics": 1, "project.ownerId": 1 } },
  ], { maxTimeMS: 3000 }).toArray()
  const page = records.slice(0, PAGE_SIZE)
  const ownerIds = [...new Set(page.map((record) => record.project.ownerId).filter(Boolean))]
  const owners = ownerIds.length ? await db.collection("user").aggregate<{ _id: ObjectId | string; name?: string }>([
    { $match: { $expr: { $in: [{ $toString: "$_id" }, ownerIds] } } },
    { $project: { name: 1 } },
  ], { maxTimeMS: 3000 }).toArray() : []
  const names = new Map(owners.map((owner) => [typeof owner._id === "string" ? owner._id : owner._id.toHexString(), owner.name?.trim() || "Publisher"]))
  return {
    projects: page.map((record) => ({
      id: record.projectId.toHexString(),
      title: record.project.title,
      description: record.project.description?.trim() || "",
      topics: record.project.topics ?? [],
      publisher: names.get(record.project.ownerId) || "Publisher",
      savedAt: record.createdAt.toISOString(),
      savedLabel: formatSavedLabel(record.createdAt),
    } satisfies SavedProjectListItem)),
    nextCursor: records.length > PAGE_SIZE ? page.at(-1)!._id.toHexString() : null,
  }
}
