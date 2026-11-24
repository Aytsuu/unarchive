import { readFileSync } from "node:fs"
import { MongoClient, ObjectId } from "mongodb"

const env = Object.fromEntries(readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/).flatMap((line) => {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/)
  return match ? [[match[1], match[2].trim()]] : []
}))
const client = new MongoClient(process.env.MONGODB_URI)
await client.connect()
const db = client.db(process.env.MONGODB_DB_NAME)
const user = await db.collection("user").findOne({ email: env.username })
if (!user) {
  console.log(JSON.stringify({ foundUser: false }))
  await client.close()
  process.exit(1)
}
const recipientId = user._id.toString()
const projects = await db.collection("projects").find({ withdrawnAt: { $exists: false } }, { projection: { title: 1 } }).limit(3).toArray()
const ids = projects.map((project) => project._id.toHexString())
while (ids.length < 3) ids.push(new ObjectId().toHexString())
const now = new Date()
const day = 24 * 60 * 60 * 1000
const expiresAt = new Date(now.getTime() + 90 * day)
const docs = [
  { dedupeKey: "test:notification:single", groupKey: `test:single:${recipientId}`, eventIds: ["test-event-single"], count: 1, hoursAgo: 2, readAt: null },
  { dedupeKey: "test:notification:group", groupKey: `test:group:${recipientId}`, eventIds: ["test-event-group-1", "test-event-group-2", "test-event-group-3"], count: 3, hoursAgo: 5, readAt: null },
  { dedupeKey: "test:notification:read", groupKey: `test:read:${recipientId}`, eventIds: ["test-event-read"], count: 1, hoursAgo: 48, readAt: new Date(now.getTime() - day) },
].map((item, index) => {
  const occurredAt = new Date(now.getTime() - item.hoursAgo * 60 * 60 * 1000)
  return {
    recipientId,
    dedupeKey: item.dedupeKey,
    groupKey: item.groupKey,
    type: "project.referenced",
    category: "project_reference",
    referencedProjectId: ids[index],
    latestReferencingProjectId: ids[index],
    eventIds: item.eventIds,
    count: item.count,
    firstOccurredAt: occurredAt,
    lastOccurredAt: occurredAt,
    readAt: item.readAt,
    createdAt: occurredAt,
    updatedAt: occurredAt,
    expiresAt,
  }
})
const collection = db.collection("notifications")
for (const doc of docs) await collection.updateOne({ dedupeKey: doc.dedupeKey, recipientId }, { $set: doc }, { upsert: true })
console.log(JSON.stringify({
  foundUser: true,
  projects: projects.map((project) => project.title),
  unread: await collection.countDocuments({ recipientId, readAt: null, expiresAt: { $gt: now } }),
  total: await collection.countDocuments({ recipientId }),
}))
await client.close()
