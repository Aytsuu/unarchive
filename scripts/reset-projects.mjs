import { MongoClient } from "mongodb"
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3"
import { validateLocalTarget } from "./reset-auth.mjs"
import { PROJECT_DEMO_KEY_PATTERN } from "../lib/project-storage-keys.mjs"

const collections = ["projectViews", "projectStars", "projects"]
class ProjectResetError extends Error {}

export async function deleteDemosFromR2(keys, env = process.env, createClient = (options) => new S3Client(options)) {
  if (!keys.length) return
  if (keys.some((key) => typeof key !== "string" || !PROJECT_DEMO_KEY_PATTERN.test(key))) throw new ProjectResetError("A project has an invalid demo image key.")
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = env
  if (!R2_ACCOUNT_ID || !/^[a-f0-9]{32}$/i.test(R2_ACCOUNT_ID) || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME || !/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(R2_BUCKET_NAME)) {
    throw new ProjectResetError("R2 storage is not configured. Check the R2 settings in .env.local.")
  }
  const client = createClient({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } })
  try {
    for (const key of keys) await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
  } finally { client.destroy() }
}

async function deleteSnapshot(collection, ids) {
  let deletedCount = 0
  for (let i = 0; i < ids.length; i += 500) {
    const result = await collection.deleteMany({ _id: { $in: ids.slice(i, i + 500) } })
    deletedCount += result.deletedCount
  }
  return deletedCount
}

export async function resetProjectData(db, onDeleted = () => {}, deleteDemos = deleteDemosFromR2) {
  const projects = await db.collection("projects").find({}, { projection: { _id: 1, demos: 1 } }).toArray()
  const demoKeys = new Set()
  for (const project of projects) {
    if (project.demos === undefined) continue
    if (!Array.isArray(project.demos) || project.demos.some((key) => typeof key !== "string" || !PROJECT_DEMO_KEY_PATTERN.test(key))) {
      throw new ProjectResetError("A project contains an invalid demo image key. No database records were deleted.")
    }
    for (const key of project.demos) demoKeys.add(key)
  }
  const snapshots = new Map([["projects", projects.map((project) => project._id)]])
  for (const name of ["projectViews", "projectStars"]) {
    const records = await db.collection(name).find({}, { projection: { _id: 1 } }).toArray()
    snapshots.set(name, records.map((record) => record._id))
  }
  if (demoKeys.size) await deleteDemos([...demoKeys])
  onDeleted({ name: "R2 demo images", deletedCount: demoKeys.size })
  const results = []
  for (const name of collections) {
    const deletedCount = await deleteSnapshot(db.collection(name), snapshots.get(name))
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
  console.log(`This permanently deletes all projects, views, and stars in local database "${database}".`)
  console.log(`Collections: ${collections.join(", ")}`)
  console.log(`Demo images referenced by these projects will also be permanently deleted from R2 bucket "${process.env.R2_BUCKET_NAME || "not configured"}".`)
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
    await resetProjectData(client.db(database), ({ name, deletedCount }) => console.log(`${name}: deleted ${deletedCount}`))
    console.log("Project reset complete.")
  } finally {
    await client.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    if (error instanceof ProjectResetError) console.error(error.message)
    console.error("Project reset failed. Some R2 images or database records may already have been deleted; check the database and R2 configuration, then rerun to finish.")
    process.exitCode = 1
  })
}
