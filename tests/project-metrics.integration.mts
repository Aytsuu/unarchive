import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { test } from "node:test"
import { MongoClient, ObjectId } from "mongodb"

const { getProjectMetrics, recordProjectView, setProjectStar } = await import(new URL("../lib/projects/metrics.ts", import.meta.url).href)
const { claimMetricsAttempt } = await import(new URL("../lib/projects/metrics-rate-limit.ts", import.meta.url).href)
const { normalizeViewIp, viewIpFromHeaders } = await import(new URL("../lib/projects/view-ip.ts", import.meta.url).href)

test("IP extraction requires a configured production proxy and normalizes addresses", () => {
  const headers = new Headers({ "x-forwarded-for": "192.0.2.1", "x-real-ip": "::ffff:192.0.2.1" })
  assert.equal(viewIpFromHeaders(headers, undefined, "production"), null)
  assert.equal(viewIpFromHeaders(headers, "x-real-ip", "production"), "192.0.2.1")
  assert.equal(viewIpFromHeaders(headers, undefined, "development"), "192.0.2.1")
  assert.equal(normalizeViewIp("::ffff:c000:201"), "192.0.2.1")
  assert.equal(normalizeViewIp("2001:0DB8:0:0:0:0:0:1"), "2001:db8::1")
  assert.equal(normalizeViewIp("fe80::1%eth0"), null)
  assert.equal(normalizeViewIp("192.0.2.1, 192.0.2.2"), null)
  assert.equal(normalizeViewIp("not-an-ip"), null)
})

test("views are once per project, IP and UTC day and stars are idempotent under concurrency", async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const name = `project_metrics_test_${randomUUID().replaceAll("-", "")}`
  try {
    await client.connect()
    const db = client.db(name)
    const project = new ObjectId()
    const otherProject = new ObjectId()
    assert.deepEqual(await getProjectMetrics(db, project, "user-a"), { views: 0, stars: 0, starred: false })
    assert.equal((await db.listCollections().toArray()).length, 0, "reading must not create collections")

    const day = new Date("2026-01-02T12:00:00Z")
    const secret = "integration-test-secret-only-0123456789abcdef"
    await Promise.all(Array.from({ length: 8 }, () => recordProjectView(db, project, "192.0.2.1", secret, day)))
    await recordProjectView(db, project, "192.0.2.1", secret, day)
    await recordProjectView(db, project, "192.0.2.2", secret, day)
    await recordProjectView(db, project, "192.0.2.1", secret, new Date("2026-01-03T00:00:00Z"))
    await recordProjectView(db, otherProject, "192.0.2.1", secret, day)
    assert.equal((await getProjectMetrics(db, project, "user-a")).views, 3)
    assert.equal((await getProjectMetrics(db, otherProject, "user-a")).views, 1)
    assert.equal(await db.collection("projectViews").countDocuments({ visitId: "192.0.2.1" }), 0, "raw IP addresses must not be stored")
    const tokens = await db.collection<{ visitId: string }>("projectViews").find({}).toArray()
    assert.equal(new Set(tokens.map((record) => record.visitId)).size, 4, "IP hashes are scoped to project and day")

    await Promise.all(Array.from({ length: 8 }, () => setProjectStar(db, project, "user-a", true)))
    await setProjectStar(db, project, "user-b", true)
    assert.deepEqual(await getProjectMetrics(db, project, "user-a"), { views: 3, stars: 2, starred: true })
    assert.deepEqual(await getProjectMetrics(db, project, "user-c"), { views: 3, stars: 2, starred: false })
    await Promise.all(Array.from({ length: 8 }, () => setProjectStar(db, project, "user-a", false)))
    assert.deepEqual(await getProjectMetrics(db, project, "user-a"), { views: 3, stars: 1, starred: false })
  } finally {
    await client.db(name).dropDatabase()
    await client.close()
  }
})

test("write limits are atomic, per user and action, and reset after the window", async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const name = `project_metrics_test_${randomUUID().replaceAll("-", "")}`
  try {
    await client.connect()
    const db = client.db(name)
    const attempts = await Promise.all(Array.from({ length: 62 }, () => claimMetricsAttempt(db, "user-a", "star")))
    assert.equal(attempts.filter((retryAfter) => retryAfter === 0).length, 60)
    assert.equal(attempts.filter((retryAfter) => retryAfter > 0).length, 2)
    assert.equal(await claimMetricsAttempt(db, "user-b", "star"), 0)
    assert.equal(await claimMetricsAttempt(db, "user-a", "view"), 0)
    await db.collection<{ _id: string; expiresAt: Date }>("projectMetricsRateLimit").updateOne({ _id: "star:user-a" }, { $set: { expiresAt: new Date(0) } })
    assert.equal(await claimMetricsAttempt(db, "user-a", "star"), 0)
  } finally {
    await client.db(name).dropDatabase()
    await client.close()
  }
})
