import { MongoClient } from "mongodb"
import { randomUUID } from "node:crypto"
import { processNotificationOutbox } from "../apps/web/lib/notifications/outbox.ts"
import { processModerationEmails } from "../apps/web/lib/notifications/moderation-email.ts"

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME
if (!uri || !dbName) throw new Error("MONGODB_URI and MONGODB_DB_NAME are required")
const client = new MongoClient(uri)
const workerId = `notifications-${randomUUID()}`
const watch = process.argv.includes("--watch")
let stopping = false
let wake
function stop() { stopping = true; wake?.() }
process.once("SIGINT", stop)
process.once("SIGTERM", stop)
await client.connect()
try {
  do {
    const processed = await processNotificationOutbox(client.db(dbName), workerId)
    const emails = await processModerationEmails(client.db(dbName), workerId)
    if (processed || emails || !watch) console.log(`Processed ${processed} notification events and ${emails} moderation email jobs.`)
    if (watch && !stopping) await new Promise((resolve) => {
      const timer = setTimeout(resolve, 5000)
      wake = () => { clearTimeout(timer); resolve() }
    })
    wake = undefined
  } while (watch && !stopping)
} finally {
  process.removeListener("SIGINT", stop)
  process.removeListener("SIGTERM", stop)
  await client.close()
}
