import type { Db } from "mongodb"

type LimitRecord = { _id: string; count: number; expiresAt: Date }
const WINDOW_MS = 60_000
const MAX_ATTEMPTS = 5

export async function claimReportAttempt(db: Db, key: string): Promise<number> {
  const limits = db.collection<LimitRecord>("contentReportRateLimit")
  await limits.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  const now = new Date()
  const expired = { $lte: [{ $ifNull: ["$expiresAt", new Date(0)] }, now] }
  const update = [{ $set: {
    count: { $cond: [expired, 1, { $add: [{ $ifNull: ["$count", 0] }, 1] }] },
    expiresAt: { $cond: [expired, new Date(now.getTime() + WINDOW_MS), "$expiresAt"] },
  } }]
  let record
  try {
    record = await limits.findOneAndUpdate({ _id: key }, update, { upsert: true, returnDocument: "after" })
  } catch (error) {
    if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error
    record = await limits.findOneAndUpdate({ _id: key }, update, { returnDocument: "after" })
  }
  if (!record) throw new Error("Unable to apply report rate limit")
  return record.count > MAX_ATTEMPTS ? Math.max(1, Math.ceil((record.expiresAt.getTime() - now.getTime()) / 1000)) : 0
}
