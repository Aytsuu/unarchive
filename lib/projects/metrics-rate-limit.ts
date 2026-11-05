import type { Db } from "mongodb"

type Limit = { _id: string; count: number; expiresAt: Date }
const indexes = new WeakMap<Db, Promise<void>>()
const WINDOW_MS = 60_000

export async function claimMetricsAttempt(db: Db, userId: string, action: "view" | "star") {
  const collection = db.collection<Limit>("projectMetricsRateLimit")
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
  const filter = { _id: `${action}:${userId}` }
  let record
  try {
    record = await collection.findOneAndUpdate(filter, update, { upsert: true, returnDocument: "after" })
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error
    record = await collection.findOneAndUpdate(filter, update, { returnDocument: "after" })
  }
  if (!record) throw new Error("Unable to apply project metrics rate limit")
  const max = action === "view" ? 120 : 60
  return record.count > max ? Math.max(1, Math.ceil((record.expiresAt.getTime() - now.getTime()) / 1000)) : 0
}
