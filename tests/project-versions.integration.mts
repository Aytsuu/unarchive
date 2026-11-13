import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { MongoClient, ObjectId } from "mongodb"
const { createInitialVersionedProject, createProjectVersion, captureLegacyBaseline, ProjectVersionConflictError, ProjectIdempotencyConflictError, ProjectNotFoundError, ProjectReferenceNotFoundError } = await import(new URL("../lib/projects/versions.ts", import.meta.url).href)

const uri = process.env.PROJECT_VERSIONS_TEST_URI

test("snapshots, updates and legacy baselines remain atomic and immutable", { skip: !uri, timeout: 60000 }, async () => {
  const client = new MongoClient(uri!, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  await client.connect()
  const hello = await client.db("admin").command({ hello: 1 })
  if (!hello.setName) { await client.close(); throw new Error("PROJECT_VERSIONS_TEST_URI must point to an isolated replica-set member") }
  const db = client.db(`project_versions_test_${randomUUID().replaceAll("-", "")}`)
  const projects = db.collection("projects")
  const versions = db.collection("projectVersions")
  try {
    const source = new ObjectId()
    await projects.insertOne({ _id: source, ownerId: "other", title: "Original reference", demos: [], createdAt: new Date(), updatedAt: new Date() })
    const projectId = new ObjectId()
    const createdAt = new Date("2024-01-01T00:00:00Z")
    const metadata = { projectType: "thesis" as const, title: "Original", description: "", abstract: "Original abstract", institution: "University", dateEnded: "2024-05", referenceProjectIds: [source.toHexString()], topics: [], links: [], contributors: ["Example, A."], consents: { permission: true as const, contributorsPermission: true as const, detailsAccurate: true as const, universityIp: true as const } }
    const original = { ...metadata, _id: projectId, ownerId: "owner", demos: ["first-key"], createdAt, updatedAt: createdAt }
    await createInitialVersionedProject(client, db, original)
    assert.equal((await projects.findOne({ _id: projectId }))?.currentVersion, 1)
    const first = await versions.findOne({ projectId, version: 1 })
    assert.equal(first?.kind, "published")
    assert.deepEqual(first?.snapshot.references, [{ id: source.toHexString(), title: "Original reference" }])
    assert.equal(first?.snapshot.consents, undefined)
    assert.equal(first?.snapshot.ownerId, undefined)
    await projects.updateOne({ _id: source }, { $set: { title: "Renamed reference" } })
    const changed = { ...metadata, title: "Revision", abstract: undefined }
    const args = { projectId, ownerId: "owner", expectedVersion: 1, project: changed, demos: ["second-key"], editKey: "key-a", editDigest: "digest-a" }
    assert.deepEqual(await createProjectVersion(client, db, args), { version: 2, replayed: false })
    assert.deepEqual(await createProjectVersion(client, db, args), { version: 2, replayed: true })
    await assert.rejects(createProjectVersion(client, db, { ...args, editDigest: "different" }), ProjectIdempotencyConflictError)
    await assert.rejects(createProjectVersion(client, db, { ...args, ownerId: "other", editKey: "unauthorized" }), ProjectNotFoundError)
    const saved = await projects.findOne({ _id: projectId })
    assert.equal(saved?.currentVersion, 2)
    assert.equal(saved?.abstract, undefined)
    assert.deepEqual(saved?.consents, metadata.consents)
    const old = await versions.findOne({ projectId, version: 1 })
    const revised = await versions.findOne({ projectId, version: 2 })
    assert.equal(old?.snapshot.title, "Original")
    assert.deepEqual(old?.snapshot.demos, ["first-key"])
    assert.deepEqual(old?.snapshot.references, [{ id: source.toHexString(), title: "Original reference" }])
    assert.equal(revised?.snapshot.abstract, undefined)
    assert.deepEqual(revised?.snapshot.references, [{ id: source.toHexString(), title: "Renamed reference" }])
    const races = await Promise.allSettled(["b", "c"].map((key) => createProjectVersion(client, db, { ...args, expectedVersion: 2, editKey: key, editDigest: key })))
    assert.equal(races.filter((result) => result.status === "fulfilled").length, 1)
    assert.ok(races.some((result) => result.status === "rejected" && result.reason instanceof ProjectVersionConflictError))
    assert.equal(await versions.countDocuments({ projectId }), 3)
    const legacyId = new ObjectId()
    await projects.insertOne({ _id: legacyId, ownerId: "owner", title: "Legacy", createdAt, updatedAt: createdAt })
    assert.deepEqual(await captureLegacyBaseline(client, db, legacyId), { version: 1, created: true })
    assert.deepEqual(await captureLegacyBaseline(client, db, legacyId), { version: 1, created: false })
    const baseline = await versions.findOne({ projectId: legacyId })
    assert.equal(baseline?.kind, "legacy")
    assert.equal(baseline?.snapshot.projectType, undefined)
    assert.equal(baseline?.snapshot.dateEnded, undefined)
    assert.deepEqual(baseline?.snapshot.demos, [])
    await projects.updateOne({ _id: source }, { $set: { withdrawnAt: new Date() } })
    await assert.rejects(createProjectVersion(client, db, { ...args, expectedVersion: 3, editKey: "withdrawn-reference" }), ProjectReferenceNotFoundError)
    await projects.updateOne({ _id: projectId }, { $set: { withdrawnAt: new Date() } })
    await assert.rejects(createProjectVersion(client, db, { ...args, expectedVersion: 3, editKey: "after-withdrawal" }), ProjectNotFoundError)
    await assert.rejects(captureLegacyBaseline(client, db, projectId), ProjectNotFoundError)
  } finally { await client.db(db.databaseName).dropDatabase(); await client.close() }
})
