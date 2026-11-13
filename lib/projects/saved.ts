import { ObjectId, type Db } from "mongodb"

type SaveRecord = { _id?: ObjectId; projectId: ObjectId; userId: string; createdAt: Date }
type SavedRow = { _id: ObjectId; projectId: ObjectId; project: { title: string } }
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
    { $project: { projectId: 1, "project.title": 1 } },
  ], { maxTimeMS: 3000 }).toArray()
  const page = records.slice(0, PAGE_SIZE)
  return {
    projects: page.map((record) => ({ id: record.projectId.toHexString(), title: record.project.title })),
    nextCursor: records.length > PAGE_SIZE ? page.at(-1)!._id.toHexString() : null,
  }
}
