import { createHmac } from "node:crypto"
import type { Db, ObjectId } from "mongodb"

type ViewRecord = { projectId: ObjectId; userId: string; visitId: string; createdAt: Date }
type StarRecord = { projectId: ObjectId; userId: string; createdAt: Date }
const indexPromises = new WeakMap<Db, Promise<void>>()

function isDuplicate(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

async function ensureMetricsIndexes(db: Db) {
  let pending = indexPromises.get(db)
  if (!pending) {
    pending = Promise.all([
      db.collection<ViewRecord>("projectViews").createIndex({ projectId: 1, userId: 1, visitId: 1 }, { unique: true }),
      db.collection<StarRecord>("projectStars").createIndex({ projectId: 1, userId: 1 }, { unique: true }),
    ]).then(() => undefined).catch((error: unknown) => { indexPromises.delete(db); throw error })
    indexPromises.set(db, pending)
  }
  await pending
}

export async function getProjectMetrics(db: Db, projectId: ObjectId, userId: string) {
  const views = db.collection<ViewRecord>("projectViews")
  const stars = db.collection<StarRecord>("projectStars")
  const [viewCount, starCount, currentStar] = await Promise.all([
    views.countDocuments({ projectId }, { maxTimeMS: 3000 }),
    stars.countDocuments({ projectId }, { maxTimeMS: 3000 }),
    stars.findOne({ projectId, userId }, { projection: { _id: 1 }, maxTimeMS: 3000 }),
  ])
  return { views: viewCount, stars: starCount, starred: currentStar !== null }
}

export async function recordProjectView(db: Db, projectId: ObjectId, ip: string, secret: string, now = new Date()) {
  await ensureMetricsIndexes(db)
  const views = db.collection<ViewRecord>("projectViews")
  const day = now.toISOString().slice(0, 10)
  const visitId = createHmac("sha256", secret).update(`${projectId.toHexString()}:${day}:${ip}`).digest("hex")
  // Keep using the existing unique index, retaining the counts of historical visits.
  try { await views.insertOne({ projectId, userId: "__daily_ip__", visitId, createdAt: now }) } catch (error) {
    if (!isDuplicate(error)) throw error
  }
  return views.countDocuments({ projectId }, { maxTimeMS: 3000 })
}

export async function setProjectStar(db: Db, projectId: ObjectId, userId: string, starred: boolean) {
  await ensureMetricsIndexes(db)
  const stars = db.collection<StarRecord>("projectStars")
  if (starred) {
    try { await stars.insertOne({ projectId, userId, createdAt: new Date() }) } catch (error) {
      if (!isDuplicate(error)) throw error
    }
  } else {
    await stars.deleteOne({ projectId, userId })
  }
  const [starCount, currentStar] = await Promise.all([
    stars.countDocuments({ projectId }, { maxTimeMS: 3000 }),
    stars.findOne({ projectId, userId }, { projection: { _id: 1 }, maxTimeMS: 3000 }),
  ])
  return { stars: starCount, starred: currentStar !== null }
}
