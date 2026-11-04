import { MongoClient } from "mongodb"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

const collections = ["session", "account", "verification", "verificationResendCooldown", "rateLimit", "user"]

export function validateLocalTarget(uri, database) {
  let target
  try { target = new URL(uri) } catch { throw new Error("MONGODB_URI must point to a single local MongoDB server.") }
  if (target.protocol !== "mongodb:" || !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
    throw new Error("MONGODB_URI must point to a single local MongoDB server.")
  }
  if (!database || /[\\/\.\s"$*<>:|?\0]/.test(database) || ["admin", "local", "config"].includes(database.toLowerCase())) {
    throw new Error("MONGODB_DB_NAME must be a valid non-system database name.")
  }
}

export async function deleteAuthRecords(db, onDeleted = () => {}) {
  const results = []
  for (const name of collections) {
    const { deletedCount } = await db.collection(name).deleteMany({})
    const result = { name, deletedCount }
    results.push(result)
    onDeleted(result)
  }
  return results
}

async function main() {
  const uri = process.env.MONGODB_URI
  const database = process.env.MONGODB_DB_NAME
  try { validateLocalTarget(uri, database) } catch (error) {
    console.error(error.message)
    process.exitCode = 1
    return
  }
  console.log(`This permanently deletes all authentication records in local database "${database}".`)
  console.log(`Collections: ${collections.join(", ")}`)
  console.log("Stop the app before continuing, but leave MongoDB running.")
  const prompt = createInterface({ input: stdin, output: stdout })
  let confirmation
  try { confirmation = await prompt.question(`Type ${database} to confirm: `) } finally { prompt.close() }
  if (confirmation !== database) {
    console.log("Cancelled. No records deleted.")
    return
  }
  const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  try {
    await client.connect()
    await deleteAuthRecords(client.db(database), ({ name, deletedCount }) => console.log(`${name}: deleted ${deletedCount}`))
    console.log("Authentication reset complete.")
  } finally {
    await client.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("Authentication reset failed. Check the local MongoDB connection and credentials. Some collections may already have been cleared.")
    process.exitCode = 1
  })
}
