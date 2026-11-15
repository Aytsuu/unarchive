import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { MongoClient, ObjectId } from "mongodb"

const { createProposal, getProposalTarget, listInbox } = await import(new URL("../lib/projects/proposals.ts", import.meta.url).href)
const { initializeProjectProposalsCollection } = await import(new URL("../scripts/init-projects.mjs", import.meta.url).href)

const uri = process.env.MONGODB_URI
test("proposals insert for other owners and list only in the owner's inbox", { skip: !uri, timeout: 60000 }, async () => {
  const client = new MongoClient(uri!, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const name = `project_proposals_test_${randomUUID().replaceAll("-", "")}`
  let connected = false
  try {
    await client.connect()
    connected = true
    const db = client.db(name)
    assert.equal(await initializeProjectProposalsCollection(db), true)
    const owned = new ObjectId()
    const emptyOwned = new ObjectId()
    const other = new ObjectId()
    const withdrawn = new ObjectId()
    await db.collection("projects").insertMany([
      { _id: owned, ownerId: "alice", title: "Owned project", createdAt: new Date("2026-01-02"), updatedAt: new Date() },
      { _id: emptyOwned, ownerId: "alice", title: "Empty owned", createdAt: new Date("2026-01-01"), updatedAt: new Date() },
      { _id: other, ownerId: "bob", title: "Someone else's project", createdAt: new Date(), updatedAt: new Date() },
      { _id: withdrawn, ownerId: "alice", title: "Withdrawn", withdrawnAt: new Date(), createdAt: new Date(), updatedAt: new Date() },
    ])
    const bobUserId = new ObjectId()
    await db.collection("user").insertOne({ _id: bobUserId, name: "Bob" })
    assert.equal((await getProposalTarget(db, owned, "alice")).error, "own_project")
    assert.equal((await getProposalTarget(db, withdrawn, "bob")).error, "not_found")
    assert.equal((await getProposalTarget(db, new ObjectId(), "bob")).error, "not_found")
    assert.equal((await getProposalTarget(db, other, "alice")).error, undefined)

    const created = await createProposal(db, { projectId: owned, senderId: bobUserId.toHexString(), message: "I would like to collaborate.", attachments: [] })
    assert.equal(typeof created.id, "string")
    const inbox = await listInbox(db, "alice", null)
    assert.equal(inbox.proposals.length, 1)
    assert.equal(inbox.proposals[0].projectTitle, "Owned project")
    assert.equal(inbox.proposals[0].senderName, "Bob")
    assert.equal(inbox.proposals[0].message, "I would like to collaborate.")
    assert.equal(inbox.nextCursor, null)
    assert.deepEqual(inbox.projects, [
      { id: owned.toHexString(), title: "Owned project" },
      { id: emptyOwned.toHexString(), title: "Empty owned" },
    ])
    const bobInbox = await listInbox(db, "bob", null)
    assert.deepEqual(bobInbox.proposals, [])
    assert.deepEqual(bobInbox.projects, [{ id: other.toHexString(), title: "Someone else's project" }])

    const extras = Array.from({ length: 51 }, () => new ObjectId())
    await db.collection("projectProposals").insertMany(extras.map((_id, index) => ({
      _id, projectId: owned, senderId: bobUserId.toHexString(), message: `Proposal ${index}`, attachments: [], createdAt: new Date(Date.now() - index),
    })))
    const first = await listInbox(db, "alice", null)
    assert.equal(first.proposals.length, 50)
    assert.ok(first.nextCursor)
    const second = await listInbox(db, "alice", first.nextCursor)
    assert.equal(second.proposals.length, 2)
    assert.equal(second.nextCursor, null)
    assert.equal(await initializeProjectProposalsCollection(db), false)
    const indexes = await db.collection("projectProposals").indexes()
    assert.ok(indexes.some(({ key }) => key.projectId === 1 && key.createdAt === -1))
    assert.ok(indexes.some(({ key }) => key.senderId === 1 && key.createdAt === -1))
  } finally {
    if (connected) await client.db(name).dropDatabase()
    await client.close()
  }
})
