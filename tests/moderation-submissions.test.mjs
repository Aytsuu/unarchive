import assert from "node:assert/strict"
import test from "node:test"
import { ObjectId } from "mongodb"
import { decideSubmission, demoSubmissions, pendingSubmissionDocument, pendingSubmissionFilter, promoteApprovedSubmissions, toQueueItem } from "../packages/domain/submissions.mjs"

function memorySubmissions(records) {
  const docs = records.map((record) => ({ ...record }))
  return {
    collection() {
      return {
        async updateOne(filter, update) {
          const doc = docs.find((item) => item._id.equals(filter._id) && item.status === filter.status)
          if (!doc) return { matchedCount: 0 }
          Object.assign(doc, update.$set)
          return { matchedCount: 1 }
        },
        async findOne(filter) {
          return docs.find((item) => item._id.equals(filter._id)) ?? null
        },
      }
    },
  }
}

test("demo submissions stay pending and keep an immutable snapshot", () => {
  const submittedAt = new Date("2026-11-20T12:00:00.000Z")
  const submissions = demoSubmissions("owner-1", submittedAt)
  assert.equal(submissions.length, 3)
  assert.deepEqual(pendingSubmissionFilter(), { status: "pending" })
  for (const submission of submissions) {
    assert.equal(submission.ownerId, "owner-1")
    assert.equal(submission.status, "pending")
    assert.equal(typeof submission.snapshot.title, "string")
    assert.ok(submission.snapshot.title.length > 0)
    submission.snapshot.topics.push("mutated")
  }
  assert.deepEqual(demoSubmissions("owner-1", submittedAt)[0].snapshot.topics, ["Environment & Sustainability", "Agriculture & Food"])
})

test("queue items expose the submitted snapshot without the review decision", () => {
  const item = toQueueItem({
    _id: { toString: () => "abc" },
    submittedAt: new Date("2026-11-20T12:00:00.000Z"),
    snapshot: { title: "Shared Water Sensors for Informal Settlements", description: "A sensor network", institution: "Mapúa University" },
  }, "Mina Santos")
  assert.deepEqual(item, {
    id: "abc",
    title: "Shared Water Sensors for Informal Settlements",
    description: "A sensor network",
    institution: "Mapúa University",
    ownerName: "Mina Santos",
    submittedAt: "2026-11-20T12:00:00.000Z",
    status: "pending",
  })
})

test("approval records the moderator only while the submission is pending", async () => {
  const id = new ObjectId()
  const decidedAt = new Date("2026-11-21T00:00:00.000Z")
  const db = memorySubmissions([{ _id: id, status: "pending" }])
  const result = await decideSubmission(db, { id: id.toString(), moderatorId: "mod-1", action: "approve", decidedAt })
  assert.deepEqual(result, { ok: true, status: "approved" })
  const stored = await db.collection().findOne({ _id: id })
  assert.equal(stored.status, "approved")
  assert.equal(stored.decidedBy, "mod-1")
  assert.equal(stored.decidedAt, decidedAt)
  assert.equal(stored.revisionReason, undefined)
  assert.deepEqual(await decideSubmission(db, { id: id.toString(), moderatorId: "mod-2", action: "approve", decidedAt }), { ok: false, error: "conflict" })
  assert.equal(stored.decidedBy, "mod-1")
})

test("a revision stores the explanation and a blank reason does not decide it", async () => {
  const id = new ObjectId()
  const db = memorySubmissions([{ _id: id, status: "pending" }])
  const blank = await decideSubmission(db, { id: id.toString(), moderatorId: "mod-1", action: "request_revision", reason: "   " })
  assert.deepEqual(blank, { ok: false, error: "reason_required" })
  const pending = await db.collection().findOne({ _id: id })
  assert.equal(pending.status, "pending")
  const decidedAt = new Date("2026-11-21T01:00:00.000Z")
  const result = await decideSubmission(db, {
    id: id.toString(),
    moderatorId: "mod-1",
    action: "request_revision",
    reason: "  Add the method, and explain why the sample is too small.  ",
    decidedAt,
  })
  assert.deepEqual(result, { ok: true, status: "changes_requested" })
  const stored = await db.collection().findOne({ _id: id })
  assert.equal(stored.status, "changes_requested")
  assert.equal(stored.revisionReason, "Add the method, and explain why the sample is too small.")
  assert.equal(stored.decidedBy, "mod-1")
  assert.equal(stored.decidedAt, decidedAt)
  assert.deepEqual(await decideSubmission(db, { id: id.toString(), moderatorId: "mod-2", action: "approve" }), { ok: false, error: "conflict" })
  assert.equal(stored.status, "changes_requested")
  assert.equal(stored.revisionReason, "Add the method, and explain why the sample is too small.")
})

test("publishing stores a pending submission instead of a public project", () => {
  const id = new ObjectId()
  const submittedAt = new Date("2026-11-21T00:00:00.000Z")
  const document = pendingSubmissionDocument({
    id,
    ownerId: "owner-1",
    submittedAt,
    demos: ["demo.png"],
    idempotencyDigest: "digest-1",
    project: {
      projectType: "thesis",
      title: "Campus Resource Hub",
      description: "A hub",
      topics: ["Education & Learning"],
      consents: { permission: true },
    },
  })
  assert.equal(document.status, "pending")
  assert.equal(document.ownerId, "owner-1")
  assert.equal(document.submittedAt, submittedAt)
  assert.equal(document.snapshot.title, "Campus Resource Hub")
  assert.deepEqual(document.snapshot.topics, ["Education & Learning"])
  assert.deepEqual(document.snapshot.demos, ["demo.png"])
  assert.equal(document.snapshot.consents, undefined)
  assert.equal(document.consents.permission, true)
  assert.equal(document.idempotencyDigest, "digest-1")
  assert.equal(String(document._id), id.toString())
})

function memoryDatabase() {
  const collections = new Map()
  const documents = (name) => {
    if (!collections.has(name)) collections.set(name, [])
    return collections.get(name)
  }
  const matches = (item, filter) => {
    if (!filter) return true
    if (filter._id) {
      const ids = filter._id.$in ?? [filter._id]
      if (!ids.some((id) => item._id?.equals?.(id))) return false
    }
    if (filter.status && item.status !== filter.status) return false
    if (filter.projectId && !item.projectId?.equals?.(filter.projectId)) return false
    if (filter.version !== undefined && item.version !== filter.version) return false
    if (filter.decidedBy && item.decidedBy !== filter.decidedBy) return false
    return true
  }
  return {
    collection(name) {
      const docs = documents(name)
      return {
        async updateOne(filter, update) {
          const doc = docs.find((item) => matches(item, filter))
          if (!doc) return { matchedCount: 0 }
          if (update.$set) Object.assign(doc, update.$set)
          if (update.$unset) for (const key of Object.keys(update.$unset)) delete doc[key]
          return { matchedCount: 1 }
        },
        async findOne(filter) {
          return docs.find((item) => matches(item, filter)) ?? null
        },
        find(filter) {
          return { async toArray() { return docs.filter((item) => matches(item, filter)) } }
        },
        async insertOne(document) {
          const duplicate = document._id && docs.some((item) => item._id?.equals?.(document._id))
          if (duplicate) { const error = new Error("duplicate"); error.code = 11000; throw error }
          docs.push(document)
        },
        async deleteOne(filter) {
          const index = docs.findIndex((item) => matches(item, filter))
          if (index >= 0) docs.splice(index, 1)
        },
      }
    },
  }
}

test("approval publishes the snapshot into the public project list", async () => {
  const id = new ObjectId()
  const decidedAt = new Date("2026-11-21T02:00:00.000Z")
  const db = memoryDatabase()
  await db.collection("projectSubmissions").insertOne({
    _id: id,
    ownerId: "owner-1",
    status: "pending",
    submittedAt: new Date("2026-11-21T01:00:00.000Z"),
    snapshot: {
      title: "Barangay clinic scheduling study",
      description: "A scheduling study",
      institution: "Example University",
      topics: ["Health & Medicine"],
      contributors: ["Alex Rivera"],
      links: ["https://example.com/clinic"],
      demos: ["clinic.png"],
      consents: { permission: true },
    },
  })
  const result = await decideSubmission(db, { id: id.toString(), moderatorId: "mod-1", action: "approve", decidedAt })
  assert.deepEqual(result, { ok: true, status: "approved" })
  const project = await db.collection("projects").findOne({ _id: id })
  assert.equal(project.title, "Barangay clinic scheduling study")
  assert.equal(project.ownerId, "owner-1")
  assert.equal(project.currentVersion, 1)
  assert.equal(project.createdAt, decidedAt)
  assert.equal(project.consents, undefined)
  assert.deepEqual(project.demos, ["clinic.png"])
  const version = await db.collection("projectVersions").findOne({ projectId: id, version: 1 })
  assert.equal(version.kind, "published")
  assert.equal(version.snapshot.title, "Barangay clinic scheduling study")
  assert.equal(version.snapshot.createdAt, decidedAt)
  assert.equal(await promoteApprovedSubmissions(db), 0)
  assert.equal((await db.collection("projectVersions").find({ projectId: id }).toArray()).length, 1)
})

test("an already approved submission is published once", async () => {
  const id = new ObjectId()
  const db = memoryDatabase()
  await db.collection("projectSubmissions").insertOne({
    _id: id,
    ownerId: "owner-1",
    status: "approved",
    decidedAt: new Date("2026-11-21T03:00:00.000Z"),
    snapshot: { title: "Shared Water Sensors for Informal Settlements", description: "Sensors", demos: [] },
  })
  assert.equal(await promoteApprovedSubmissions(db), 1)
  assert.equal((await db.collection("projects").findOne({ _id: id })).title, "Shared Water Sensors for Informal Settlements")
  assert.equal(await promoteApprovedSubmissions(db), 0)
})

test("a missing submission cannot be decided", async () => {
  const db = memorySubmissions([])
  assert.deepEqual(await decideSubmission(db, { id: "not-an-id", moderatorId: "mod-1", action: "approve" }), { ok: false, error: "not_found" })
  assert.deepEqual(await decideSubmission(db, { id: new ObjectId().toString(), moderatorId: "mod-1", action: "approve" }), { ok: false, error: "not_found" })
})
