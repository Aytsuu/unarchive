import { MongoClient } from "mongodb"
import { randomUUID } from "node:crypto"
import { deliverPublishWebhooks } from "../apps/web/lib/webhooks/publish-moderation.ts"

if (!process.env.NODE_ENV) process.env.NODE_ENV = "development"
if (process.env.NODE_ENV !== "development") {
  console.error("Publication webhooks run only in development.")
  process.exit(0)
}

const uri = process.env.MONGODB_URI
const dbName = process.env.MONGODB_DB_NAME
if (!uri || !dbName) throw new Error("MONGODB_URI and MONGODB_DB_NAME are required")

const client = new MongoClient(uri)
const workerId = `publish-webhook-${randomUUID()}`
const watch = process.argv.includes("--watch")
let stopping = false
let wake
function stop() { stopping = true; wake?.() }
process.once("SIGINT", stop)
process.once("SIGTERM", stop)
await client.connect()
try {
  do {
    const delivered = await deliverPublishWebhooks(client.db(dbName), workerId, { development: true })
    if (delivered || !watch) console.log(`Delivered ${delivered} publication webhooks.`)
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
