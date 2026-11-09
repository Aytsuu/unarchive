import type { Db } from "mongodb"

type SearchRateLimit = { _id: string; count: number; expiresAt: Date }
type ProjectTitle = { title: string; createdAt?: Date }
const indexes = new WeakMap<Db, Promise<void>>()
const WINDOW_MS = 60_000
const MAX_REQUESTS = 120

export function parseReferenceQuery(value: string | null): string | null {
  if (value === null) return ""
  if (value.length > 100 || /[\u0000-\u001f\u007f]/.test(value)) return null
  return value.trim()
}

export async function searchReferenceProjects(db: Db, query: string) {
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const filter = escaped ? { title: { $regex: escaped, $options: "i" } } : {}
  const records = await db.collection<ProjectTitle>("projects")
    .find(filter, { projection: { title: 1 }, maxTimeMS: 3000 })
    .sort({ createdAt: -1, _id: -1 }).limit(20).toArray()
  return records.map((record) => ({ id: record._id.toString(), title: record.title }))
}

export async function claimReferenceSearch(db: Db, userId: string) {
  const collection = db.collection<SearchRateLimit>("projectReferenceSearchRateLimit")
  let index = indexes.get(db)
  if (!index) {
    index = collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }).then(() => undefined).catch((error: unknown) => { indexes.delete(db); throw error })
    indexes.set(db, index)
  }
  await index
  const now = new Date()
  const expired = { $lte: [{ $ifNull: ["$expiresAt", new Date(0)] }, now] }
  const update = [{ $set: {
    count: { $cond: [expired, 1, { $add: [{ $ifNull: ["$count", 0] }, 1] }] },
    expiresAt: { $cond: [expired, new Date(now.getTime() + WINDOW_MS), "$expiresAt"] },
  } }]
  let record
  try {
    record = await collection.findOneAndUpdate({ _id: userId }, update, { upsert: true, returnDocument: "after" })
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error
    record = await collection.findOneAndUpdate({ _id: userId }, update, { returnDocument: "after" })
  }
  if (!record) throw new Error("Unable to apply reference search rate limit")
  return record.count > MAX_REQUESTS ? Math.max(1, Math.ceil((record.expiresAt.getTime() - now.getTime()) / 1000)) : 0
}
