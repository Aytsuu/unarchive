import { MongoClient } from "mongodb"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { validateLocalTarget } from "./reset-auth.mjs"

export async function backfillProjectVersions(client, db, capture, report = () => {}) {
  let created = 0
  let existing = 0
  const cursor = db.collection("projects").find({ withdrawnAt: { $exists: false } }, { projection: { _id: 1 }, sort: { _id: 1 }, batchSize: 100 })
  for await (const project of cursor) {
    const result = await capture(client, db, project._id)
    if (result.created) created++
    else existing++
    report({ id: project._id.toString(), ...result })
  }
  return { created, existing }
}

async function main() {
  const uri = process.env.MONGODB_URI
  const name = process.env.MONGODB_DB_NAME
  validateLocalTarget(uri, name)
  if (!process.argv.includes("--apply")) {
    console.log("Dry run only. Pass --apply to capture legacy project baselines in the configured local database.")
    return
  }
  const { captureLegacyBaseline } = await import(new URL("../lib/projects/versions.ts", import.meta.url).href)
  const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  try {
    await client.connect()
    const hello = await client.db("admin").command({ hello: 1 })
    if (!hello.setName || hello.logicalSessionTimeoutMinutes == null) throw new Error("Project versioning requires a MongoDB replica set with transactions.")
    const result = await backfillProjectVersions(client, client.db(name), captureLegacyBaseline)
    console.log(`Captured ${result.created} legacy baselines; ${result.existing} projects already had a version.`)
  } finally { await client.close() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => { console.error("Project version backfill failed:", error.message); process.exitCode = 1 })
}
