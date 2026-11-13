import assert from "node:assert/strict"
import { test } from "node:test"
import { ObjectId } from "mongodb"
const { projectSnapshot, ProjectVersionConflictError, createProjectVersion, captureLegacyBaseline, createInitialVersionedProject } = await import(new URL("../lib/projects/versions.ts", import.meta.url).href)

const id = new ObjectId("65c000000000000000000001")
const when = new Date("2025-05-01T00:00:00Z")
const input = { _id: id, ownerId: "owner", title: "A title", projectType: "thesis", dateEnded: "2024-05", contributors: ["Santos, A."], abstract: "Summary", institution: "University", demos: ["demo-key"], createdAt: when, updatedAt: when, idempotencyDigest: "secret", consents: { permission: true } }

test("snapshots contain only public project content and independent arrays", () => {
  const snapshot = projectSnapshot(input)
  assert.deepEqual(snapshot, { title: "A title", projectType: "thesis", dateEnded: "2024-05", contributors: ["Santos, A."], abstract: "Summary", institution: "University", demos: ["demo-key"], createdAt: when })
  input.contributors.push("New author")
  assert.deepEqual(snapshot.contributors, ["Santos, A."])
  input.contributors.pop()
  assert.equal("ownerId" in snapshot, false)
  assert.equal("consents" in snapshot, false)
  assert.equal("idempotencyDigest" in snapshot, false)
})

test("rejects malformed historical asset references instead of silently losing them", () => {
  assert.throws(() => projectSnapshot({ ...input, demos: [42] } as never), /inconsistent/i)
})

test("version conflict has a stable machine-readable type", () => {
  const error = new ProjectVersionConflictError()
  assert.ok(error instanceof Error)
  assert.equal(error.name, "ProjectVersionConflictError")
})

test("version operations refuse to run without transaction support", async () => {
  const client = { startSession: () => ({ withTransaction: async () => { throw new Error("Transaction numbers are only allowed on a replica set member or mongos") }, endSession: async () => {} }) }
  const db = { collection: () => ({ createIndex: async () => {} }) }
  await assert.rejects(createInitialVersionedProject(client as never, db as never, input as never), /Transaction numbers/)
  await assert.rejects(createProjectVersion(client as never, db as never, { projectId: id, ownerId: "owner", expectedVersion: 1, project: {} as never, demos: [], editKey: "key", editDigest: "digest" }), /Transaction numbers/)
  await assert.rejects(captureLegacyBaseline(client as never, db as never, id), /Transaction numbers/)
})
