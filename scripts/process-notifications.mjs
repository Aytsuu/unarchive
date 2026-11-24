import { MongoClient } from "mongodb"
import { processNotificationOutbox } from "../lib/notifications/outbox.ts"

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME
if (!uri || !dbName) throw new Error("MONGODB_URI and MONGODB_DB_NAME are required")
const client = new MongoClient(uri)
await client.connect()
try {
  const processed = await processNotificationOutbox(client.db(dbName), `local-${process.pid}`)
  console.log(`Processed ${processed} notification events.`)
} finally {
  await client.close()
}
