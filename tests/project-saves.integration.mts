import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { MongoClient, ObjectId } from "mongodb"
const { getProjectSaved, getSavedProjectIds, listSavedProjects, setProjectSaved } = await import(new URL("../lib/projects/saved.ts", import.meta.url).href)

const uri = process.env.MONGODB_URI
test("saved projects are private, idempotent, paginated, and exclude withdrawn projects", { skip: !uri, timeout: 60000 }, async () => {
  const client = new MongoClient(uri!, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const name = `project_saves_test_${randomUUID().replaceAll("-", "")}`
  let connected = false
  try {
    await client.connect()
    connected = true
    const db = client.db(name)
    const id = new ObjectId()
    await db.collection("projects").insertOne({ _id: id, title: "Visible" })
    await Promise.all(Array.from({ length: 6 }, () => setProjectSaved(db, id, "alice", true)))
    assert.equal(await db.collection("projectSaves").countDocuments(), 1)
    assert.equal(await getProjectSaved(db, id, "alice"), true)
    assert.equal(await getProjectSaved(db, id, "bob"), false)
    assert.deepEqual([...await getSavedProjectIds(db, [id], "alice")], [id.toHexString()])
    assert.equal((await getSavedProjectIds(db, [id], "bob")).size, 0)
    assert.deepEqual((await listSavedProjects(db, "bob", null)).projects, [])
    const ids = Array.from({ length: 55 }, () => new ObjectId())
    await db.collection("projects").insertMany(ids.map((_id, i) => ({ _id, title: `Project ${i}` })))
    for (const projectId of ids) await setProjectSaved(db, projectId, "alice", true)
    await db.collection("projects").updateOne({ _id: ids[0] }, { $set: { withdrawnAt: new Date() } })
    const first = await listSavedProjects(db, "alice", null)
    assert.equal(first.projects.length, 50)
    assert.ok(first.nextCursor)
    const second = await listSavedProjects(db, "alice", first.nextCursor)
    assert.equal(second.projects.length, 5)
    assert.equal(second.nextCursor, null)
    assert.equal(new Set([...first.projects, ...second.projects].map((project) => project.id)).size, 55)
    assert.ok(![...first.projects, ...second.projects].some((project) => project.id === ids[0].toHexString()))
    await setProjectSaved(db, id, "alice", false)
    await setProjectSaved(db, id, "alice", false)
    assert.equal(await getProjectSaved(db, id, "alice"), false)
  } finally {
    if (connected) await client.db(name).dropDatabase()
    await client.close()
  }
})
