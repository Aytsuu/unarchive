import { MongoClient } from "mongodb"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { validateLocalTarget } from "./reset-auth.mjs"
import { PROJECT_TOPICS } from "../lib/project-topics.mjs"

const projectValidator = {
  $jsonSchema: {
    bsonType: "object",
    required: ["ownerId", "title", "createdAt", "updatedAt"],
    properties: {
      ownerId: { bsonType: "string", minLength: 1, description: "Better Auth user ID" },
      title: { bsonType: "string", minLength: 1 },
      description: { bsonType: "string" },
      abstract: { bsonType: "string", maxLength: 10000 },
      topics: { bsonType: "array", maxItems: PROJECT_TOPICS.length, uniqueItems: true, items: { bsonType: "string", enum: [...PROJECT_TOPICS] } },
      referenceProjectIds: { bsonType: "array", maxItems: 20, uniqueItems: true, items: { bsonType: "string", pattern: "^[a-f0-9]{24}$" } },
      links: { bsonType: "array", items: { bsonType: "string" } },
      demos: { bsonType: "array", items: { bsonType: "string" }, description: "References to demo assets" },
      institution: { bsonType: "string" },
      dateStarted: { bsonType: "string", pattern: "^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$" },
      dateEnded: { bsonType: "string", pattern: "^(?!0000)[0-9]{4}-(0[1-9]|1[0-2])$" },
      contributors: { bsonType: "array", items: { bsonType: "string" } },
      consents: {
        bsonType: "object",
        properties: { permission: { bsonType: "bool" }, contributorsPermission: { bsonType: "bool" }, detailsAccurate: { bsonType: "bool" } },
      },
      createdAt: { bsonType: "date" },
      updatedAt: { bsonType: "date" },
    },
  },
}

export async function initializeProjectsCollection(db) {
  let created = false
  const existing = await db.listCollections({ name: "projects" }, { nameOnly: true }).hasNext()
  if (!existing) {
    try {
      await db.createCollection("projects", { validator: projectValidator, validationLevel: "strict", validationAction: "error" })
      created = true
    } catch (error) {
      if (error?.code !== 48) throw error
    }
  }
  const projects = db.collection("projects")
  await projects.createIndex({ ownerId: 1, createdAt: -1 })
  await projects.createIndex({ createdAt: -1 })
  return created
}

async function main() {
  const uri = process.env.MONGODB_URI
  const name = process.env.MONGODB_DB_NAME
  validateLocalTarget(uri, name)
  const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  try {
    await client.connect()
    const created = await initializeProjectsCollection(client.db(name))
    console.log(created ? `Created projects collection in ${name}.` : `Projects collection already exists in ${name}; existing validation was left unchanged.`)
    console.log("Project indexes are ready.")
  } finally {
    await client.close()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error("Could not initialize projects. Check the local MongoDB configuration and connection.")
    process.exitCode = 1
  })
}
