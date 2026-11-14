import { ObjectId, type Db } from "mongodb"

export type ProposalRecord = {
  _id?: ObjectId
  projectId: ObjectId
  senderId: string
  message: string
  attachments: string[]
  createdAt: Date
}

export type InboxProposal = {
  id: string
  projectId: string
  projectTitle: string
  senderName: string
  message: string
  createdAt: string
  attachmentCount: number
}

type ProposalProject = { _id: ObjectId; ownerId: string; title: string; withdrawnAt?: Date }
type InboxRow = ProposalRecord & { _id: ObjectId; project: { title: string } }

const PAGE_SIZE = 50
const indexPromises = new WeakMap<Db, Promise<void>>()

async function ensureIndexes(db: Db) {
  let pending = indexPromises.get(db)
  if (!pending) {
    const collection = db.collection<ProposalRecord>("projectProposals")
    pending = Promise.all([
      collection.createIndex({ projectId: 1, createdAt: -1 }),
      collection.createIndex({ senderId: 1, createdAt: -1 }),
    ]).then(() => undefined).catch((error: unknown) => { indexPromises.delete(db); throw error })
    indexPromises.set(db, pending)
  }
  await pending
}

export async function getProposalTarget(db: Db, projectId: ObjectId, senderId: string) {
  const project = await db.collection<ProposalProject>("projects").findOne({ _id: projectId, withdrawnAt: { $exists: false } }, { projection: { ownerId: 1, title: 1 }, maxTimeMS: 3000 })
  if (!project) return { error: "not_found" as const }
  if (project.ownerId === senderId) return { error: "own_project" as const }
  return { project }
}

export async function createProposal(db: Db, args: { projectId: ObjectId; senderId: string; message: string; attachments: string[] }) {
  const target = await getProposalTarget(db, args.projectId, args.senderId)
  if ("error" in target) throw new Error(target.error)
  await ensureIndexes(db)
  const createdAt = new Date()
  const result = await db.collection<ProposalRecord>("projectProposals").insertOne({
    projectId: args.projectId,
    senderId: args.senderId,
    message: args.message,
    attachments: args.attachments,
    createdAt,
  })
  return { id: result.insertedId.toHexString(), createdAt }
}

export async function listInbox(db: Db, ownerId: string, cursor: string | null) {
  const records = await db.collection<ProposalRecord>("projectProposals").aggregate<InboxRow>([
    { $lookup: { from: "projects", localField: "projectId", foreignField: "_id", as: "project" } },
    { $unwind: "$project" },
    { $match: { "project.ownerId": ownerId, "project.withdrawnAt": { $exists: false }, ...(cursor ? { _id: { $lt: new ObjectId(cursor) } } : {}) } },
    { $sort: { _id: -1 } },
    { $limit: PAGE_SIZE + 1 },
    { $project: { projectId: 1, senderId: 1, message: 1, attachments: 1, createdAt: 1, "project.title": 1 } },
  ], { maxTimeMS: 3000 }).toArray()
  const page = records.slice(0, PAGE_SIZE)
  const senderIds = [...new Set(page.map((record) => record.senderId))]
  const users = senderIds.length ? await db.collection("user").aggregate<{ _id: ObjectId | string; name?: string }>([
    { $match: { $expr: { $in: [{ $toString: "$_id" }, senderIds] } } },
    { $project: { name: 1 } },
  ], { maxTimeMS: 3000 }).toArray() : []
  const names = new Map(users.map((user) => [typeof user._id === "string" ? user._id : user._id.toHexString(), user.name?.trim() || "Member"]))
  return {
    proposals: page.map((record) => ({
      id: record._id.toHexString(),
      projectId: record.projectId.toHexString(),
      projectTitle: record.project.title,
      senderName: names.get(record.senderId) || "Member",
      message: record.message,
      createdAt: record.createdAt.toISOString(),
      attachmentCount: record.attachments.length,
    } satisfies InboxProposal)),
    nextCursor: records.length > PAGE_SIZE ? page.at(-1)!._id.toHexString() : null,
  }
}