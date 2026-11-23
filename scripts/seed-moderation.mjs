import { readFileSync } from "node:fs"
import { MongoClient } from "mongodb"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { grantModeratorAccess } from "../packages/domain/access.mjs"
import { demoSubmissions, SUBMISSIONS_COLLECTION } from "../packages/domain/submissions.mjs"
import { readTestAccount } from "../packages/domain/test-account.mjs"
import { validateLocalTarget } from "./reset-auth.mjs"

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export async function seedModeration(db, email) {
  const normalized = email.trim().toLowerCase()
  const user = await db.collection("user").findOne(
    { email: { $regex: `^${escapeRegex(normalized)}$`, $options: "i" } },
    { projection: { email: 1, emailVerified: 1 }, maxTimeMS: 3000 },
  )
  if (!user) throw new Error("No account exists for the username in .env.local. Create that account on the web app first.")
  const userId = String(user._id)
  if (user.emailVerified !== true) {
    await db.collection("user").updateOne({ _id: user._id }, { $set: { emailVerified: true } })
  }
  await grantModeratorAccess(db, userId)
  const submissions = db.collection(SUBMISSIONS_COLLECTION)
  await submissions.createIndex({ status: 1, submittedAt: 1 })
  await submissions.createIndex({ seedKey: 1 }, { unique: true, partialFilterExpression: { seedKey: { $exists: true } } })
  const documents = demoSubmissions(userId)
  for (const document of documents) {
    await submissions.updateOne({ seedKey: document.seedKey }, { $setOnInsert: document }, { upsert: true })
  }
  return documents.map((document) => document.snapshot.title)
}

async function main() {
  const uri = process.env.MONGODB_URI
  const database = process.env.MONGODB_DB_NAME
  try { validateLocalTarget(uri, database) } catch (error) {
    console.error(error.message)
    process.exitCode = 1
    return
  }
  const { username } = readTestAccount(readFileSync(".env.local", "utf8"))
  const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  try {
    await client.connect()
    const titles = await seedModeration(client.db(database), username)
    console.log("Moderator access granted.")
    console.log("Pending submissions ready:")
    for (const title of titles) console.log(`- ${title}`)
  } finally {
    await client.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : "Could not seed moderation data.")
    process.exitCode = 1
  })
}
