import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { ObjectId } from "mongodb"
import { insertPendingSubmission, PUBLISH_WEBHOOK_COLLECTION, PUBLISH_WEBHOOK_EVENT_TYPE, resubmitSubmission, SUBMISSIONS_COLLECTION } from "../packages/domain/submissions.mjs"
import { deliverPublishWebhooks, PUBLISH_WEBHOOK_MAX_ATTEMPTS } from "../apps/web/lib/webhooks/publish-moderation.ts"

const WEBHOOK_URL = "https://bot.example/hook"
const WEBHOOK_SECRET = "local-webhook-secret"

function compare(left, right) {
  const value = (item) => item instanceof Date ? item.getTime() : item
  const a = value(left)
  const b = value(right)
  if (a == null || b == null || Number.isNaN(a) || Number.isNaN(b)) return Number.NaN
  if (a < b) return -1
  if (a > b) return 1
  return 0
}

function same(left, right) {
  if (Object.is(left, right)) return true
  if (left && typeof left.equals === "function" && left.equals(right)) return true
  if (right && typeof right.equals === "function" && right.equals(left)) return true
  return false
}

function matches(item, filter) {
  if (!filter) return true
  return Object.entries(filter).every(([key, expected]) => {
    if (key === "$or") return expected.some((branch) => matches(item, branch))
    if (expected && typeof expected === "object" && !(expected instanceof Date) && !Array.isArray(expected)) {
      if ("$in" in expected) return expected.$in.some((candidate) => same(item[key], candidate))
      if ("$lte" in expected) {
        const compared = compare(item[key], expected.$lte)
        return !Number.isNaN(compared) && compared <= 0
      }
      if ("$exists" in expected) {
        const present = Object.prototype.hasOwnProperty.call(item, key) && item[key] !== undefined
        return expected.$exists ? present : !present
      }
    }
    return same(item[key], expected)
  })
}

function duplicateKey() {
  const error = new Error("duplicate")
  error.code = 11000
  return error
}

function applyUpdate(doc, update) {
  if (update.$set) Object.assign(doc, update.$set)
  if (update.$inc) for (const [key, value] of Object.entries(update.$inc)) doc[key] = (doc[key] ?? 0) + value
  if (update.$unset) for (const key of Object.keys(update.$unset)) delete doc[key]
}

function memoryDatabase() {
  const collections = new Map()
  const documents = (name) => {
    if (!collections.has(name)) collections.set(name, [])
    return collections.get(name)
  }
  return {
    snapshot() {
      return new Map([...collections.entries()].map(([name, docs]) => [name, docs.map((doc) => ({ ...doc }))]))
    },
    restore(saved) {
      for (const [name, docs] of collections) {
        const original = saved.get(name) ?? []
        docs.splice(0, docs.length, ...original.map((doc) => ({ ...doc })))
      }
    },
    collection(name) {
      const docs = documents(name)
      return {
        async createIndex() {},
        async countDocuments(filter = {}) {
          return docs.filter((item) => matches(item, filter)).length
        },
        async findOne(filter = {}) {
          return docs.find((item) => matches(item, filter)) ?? null
        },
        async insertOne(document) {
          if (document._id && docs.some((item) => same(item._id, document._id))) throw duplicateKey()
          if (document.eventId && docs.some((item) => item.eventId === document.eventId)) throw duplicateKey()
          docs.push(document)
        },
        async updateOne(filter, update) {
          const doc = docs.find((item) => matches(item, filter))
          if (!doc) return { matchedCount: 0 }
          applyUpdate(doc, update)
          return { matchedCount: 1 }
        },
        async findOneAndUpdate(filter, update, options = {}) {
          let rows = docs.filter((item) => matches(item, filter))
          if (options.sort) {
            rows = [...rows].sort((left, right) => {
              for (const [key, direction] of Object.entries(options.sort)) {
                const compared = compare(left[key], right[key])
                if (!Number.isNaN(compared) && compared !== 0) return compared * direction
              }
              return 0
            })
          }
          const doc = rows[0]
          if (!doc) return null
          applyUpdate(doc, update)
          return doc
        },
      }
    },
  }
}

function transactionClient(db) {
  return {
    startSession() {
      return {
        async withTransaction(work) {
          const saved = db.snapshot()
          try {
            return await work()
          } catch (error) {
            db.restore(saved)
            throw error
          }
        },
        async endSession() {},
      }
    },
  }
}

function submissionInput(id = new ObjectId(), submittedAt = new Date("2026-11-26T00:00:00.000Z")) {
  return { id, ownerId: "owner", submittedAt, project: { title: "Coastal sensors" }, demos: [] }
}

function pendingDelivery(submissionId, nextAttemptAt = new Date("2026-11-26T00:00:00.000Z")) {
  return {
    eventId: submissionId,
    type: PUBLISH_WEBHOOK_EVENT_TYPE,
    submissionId,
    state: "pending",
    attempts: 0,
    nextAttemptAt,
    occurredAt: nextAttemptAt,
  }
}

function recordingFetch(response) {
  const calls = []
  const send = async (url, init) => {
    calls.push({ url, method: init.method, redirect: init.redirect, headers: { ...init.headers }, body: init.body })
    const next = typeof response === "function" ? response(calls.length) : response
    if (next instanceof Error) throw next
    return next
  }
  return { calls, send }
}

function deliver(db, options) {
  return deliverPublishWebhooks(db, options.workerId ?? "worker-1", {
    now: options.now,
    fetch: options.fetch,
    url: options.url ?? WEBHOOK_URL,
    secret: options.secret ?? WEBHOOK_SECRET,
    development: options.development ?? true,
    limit: options.limit ?? 20,
  })
}

test("publication webhook delivery", async (t) => {
  await t.test("a new submission stores one delivery and an idempotent retry does not add another", async () => {
    const db = memoryDatabase()
    const client = transactionClient(db)
    const input = submissionInput()
    await insertPendingSubmission(db, input, client)
    await assert.rejects(() => insertPendingSubmission(db, input, client), (error) => error.code === 11000)
    assert.equal(await db.collection(SUBMISSIONS_COLLECTION).countDocuments({ _id: input.id }), 1)
    assert.equal(await db.collection(PUBLISH_WEBHOOK_COLLECTION).countDocuments({ eventId: input.id.toString() }), 1)
    const delivery = await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: input.id.toString() })
    assert.equal(delivery.type, PUBLISH_WEBHOOK_EVENT_TYPE)
    assert.equal(delivery.submissionId, input.id.toString())
    assert.equal(delivery.state, "pending")
    assert.equal(delivery.attempts, 0)
    assert.equal(delivery.nextAttemptAt.toISOString(), input.submittedAt.toISOString())
  })

  await t.test("a submission without a transaction client does not create a delivery", async () => {
    const db = memoryDatabase()
    const input = submissionInput()
    await insertPendingSubmission(db, input)
    assert.equal(await db.collection(SUBMISSIONS_COLLECTION).countDocuments({ _id: input.id }), 1)
    assert.equal(await db.collection(PUBLISH_WEBHOOK_COLLECTION).countDocuments({}), 0)
  })

  await t.test("a failed submission transaction creates no delivery", async () => {
    const db = memoryDatabase()
    const input = submissionInput()
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne(pendingDelivery(input.id.toString()))
    await assert.rejects(() => insertPendingSubmission(db, input, transactionClient(db)), (error) => error.code === 11000)
    assert.equal(await db.collection(SUBMISSIONS_COLLECTION).countDocuments({ _id: input.id }), 0)
    assert.equal(await db.collection(PUBLISH_WEBHOOK_COLLECTION).countDocuments({ eventId: input.id.toString() }), 1)
  })

  await t.test("a revision resubmission stores one delivery for the new snapshot and a retry does not add another", async () => {
    const db = memoryDatabase()
    const previousId = new ObjectId()
    const nextId = new ObjectId()
    const laterId = new ObjectId()
    const submittedAt = new Date("2026-11-26T00:00:00.000Z")
    await db.collection(SUBMISSIONS_COLLECTION).insertOne({
      _id: previousId,
      ownerId: "owner",
      status: "changes_requested",
      submittedAt: new Date("2026-11-20T00:00:00.000Z"),
      snapshot: { title: "Original title", demos: [] },
    })
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne(pendingDelivery(previousId.toString(), new Date("2026-11-20T00:00:00.000Z")))
    const input = {
      previousId: previousId.toString(),
      id: nextId,
      ownerId: "owner",
      submittedAt,
      project: { title: "Revised title" },
      demos: [],
      idempotencyDigest: "digest",
    }
    const client = transactionClient(db)
    assert.deepEqual(await resubmitSubmission(client, db, input, { notify: true }), { ok: true, id: nextId.toString(), replayed: false })
    assert.deepEqual(await resubmitSubmission(client, db, input, { notify: true }), { ok: true, id: nextId.toString(), replayed: true })
    assert.equal(await db.collection(PUBLISH_WEBHOOK_COLLECTION).countDocuments({ eventId: nextId.toString() }), 1)
    assert.equal(await db.collection(PUBLISH_WEBHOOK_COLLECTION).countDocuments({ eventId: previousId.toString() }), 1)
    const delivery = await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: nextId.toString() })
    assert.equal(delivery.type, PUBLISH_WEBHOOK_EVENT_TYPE)
    assert.equal(delivery.submissionId, nextId.toString())
    assert.equal(delivery.state, "pending")
    assert.equal(delivery.nextAttemptAt.toISOString(), submittedAt.toISOString())
    await db.collection(SUBMISSIONS_COLLECTION).updateOne({ _id: nextId }, { $set: { status: "changes_requested" } })
    assert.deepEqual(await resubmitSubmission(client, db, { ...input, previousId: nextId.toString(), id: laterId, idempotencyDigest: "later" }, { notify: true }), { ok: true, id: laterId.toString(), replayed: false })
    assert.equal(await db.collection(PUBLISH_WEBHOOK_COLLECTION).countDocuments({ eventId: laterId.toString() }), 1)
    assert.equal(await db.collection(PUBLISH_WEBHOOK_COLLECTION).countDocuments({}), 3)
  })

  await t.test("a resubmission without notification creates no delivery", async () => {
    const db = memoryDatabase()
    const previousId = new ObjectId()
    const nextId = new ObjectId()
    await db.collection(SUBMISSIONS_COLLECTION).insertOne({
      _id: previousId,
      ownerId: "owner",
      status: "changes_requested",
      submittedAt: new Date("2026-11-20T00:00:00.000Z"),
      snapshot: { title: "Original title", demos: [] },
    })
    const result = await resubmitSubmission(transactionClient(db), db, {
      previousId: previousId.toString(),
      id: nextId,
      ownerId: "owner",
      submittedAt: new Date("2026-11-26T00:00:00.000Z"),
      project: { title: "Revised title" },
      demos: [],
      idempotencyDigest: "digest",
    })
    assert.deepEqual(result, { ok: true, id: nextId.toString(), replayed: false })
    assert.equal(await db.collection(PUBLISH_WEBHOOK_COLLECTION).countDocuments({}), 0)
  })

  await t.test("a failed resubmission transaction creates no delivery", async () => {
    const db = memoryDatabase()
    const previousId = new ObjectId()
    const nextId = new ObjectId()
    await db.collection(SUBMISSIONS_COLLECTION).insertOne({
      _id: previousId,
      ownerId: "owner",
      status: "changes_requested",
      submittedAt: new Date("2026-11-20T00:00:00.000Z"),
      snapshot: { title: "Original title", demos: [] },
    })
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne(pendingDelivery(nextId.toString()))
    await assert.rejects(() => resubmitSubmission(transactionClient(db), db, {
      previousId: previousId.toString(),
      id: nextId,
      ownerId: "owner",
      submittedAt: new Date("2026-11-26T00:00:00.000Z"),
      project: { title: "Rolled back" },
      demos: [],
      idempotencyDigest: "digest",
    }, { notify: true }), (error) => error.code === 11000)
    assert.equal(await db.collection(SUBMISSIONS_COLLECTION).countDocuments({ _id: nextId }), 0)
    assert.equal((await db.collection(SUBMISSIONS_COLLECTION).findOne({ _id: previousId })).status, "changes_requested")
    assert.equal((await db.collection(SUBMISSIONS_COLLECTION).findOne({ _id: previousId })).resubmittedAs, undefined)
    assert.equal(await db.collection(PUBLISH_WEBHOOK_COLLECTION).countDocuments({ eventId: nextId.toString() }), 1)
  })

  await t.test("a successful delivery posts the authenticated event and leaves the submission pending", async () => {
    const db = memoryDatabase()
    const id = new ObjectId().toString()
    const now = new Date("2026-11-26T00:00:00.000Z")
    await db.collection(SUBMISSIONS_COLLECTION).insertOne({ _id: id, status: "pending", title: "Coastal sensors" })
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne(pendingDelivery(id, now))
    const recorded = recordingFetch(new Response(null, { status: 204 }))
    assert.equal(await deliver(db, { now, fetch: recorded.send }), 1)
    assert.equal(recorded.calls.length, 1)
    assert.equal(recorded.calls[0].url, WEBHOOK_URL)
    assert.equal(recorded.calls[0].method, "POST")
    assert.equal(recorded.calls[0].redirect, "error")
    assert.equal(recorded.calls[0].headers.authorization, `Bearer ${WEBHOOK_SECRET}`)
    assert.equal(recorded.calls[0].headers["content-type"], "application/json")
    assert.deepEqual(JSON.parse(recorded.calls[0].body), { type: PUBLISH_WEBHOOK_EVENT_TYPE, submissionId: id })
    const delivery = await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: id })
    assert.equal(delivery.state, "delivered")
    assert.equal(delivery.attempts, 1)
    assert.equal(delivery.deliveredAt.toISOString(), now.toISOString())
    assert.equal(delivery.lastError, undefined)
    assert.equal((await db.collection(SUBMISSIONS_COLLECTION).findOne({ _id: id })).status, "pending")
  })

  await t.test("a failed delivery is retried, then delivered, without removing the submission", async () => {
    const db = memoryDatabase()
    const id = new ObjectId().toString()
    const now = new Date("2026-11-26T00:00:00.000Z")
    await db.collection(SUBMISSIONS_COLLECTION).insertOne({ _id: id, status: "pending" })
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne(pendingDelivery(id, now))
    const recorded = recordingFetch((attempt) => attempt === 1 ? new Response(`denied ${WEBHOOK_SECRET}`, { status: 503 }) : new Response(null, { status: 200 }))
    assert.equal(await deliver(db, { now, fetch: recorded.send, limit: 5 }), 0)
    assert.equal(await deliver(db, { now, fetch: recorded.send, limit: 5 }), 0)
    let delivery = await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: id })
    assert.equal(delivery.state, "pending")
    assert.equal(delivery.attempts, 1)
    assert.equal(delivery.lastError, "HTTP 503: denied [redacted]")
    assert.equal(delivery.lastError.includes(WEBHOOK_SECRET), false)
    assert.equal(delivery.nextAttemptAt.toISOString(), new Date(now.getTime() + 2000).toISOString())
    assert.equal((await db.collection(SUBMISSIONS_COLLECTION).findOne({ _id: id })).status, "pending")
    const later = new Date(now.getTime() + 2000)
    assert.equal(await deliver(db, { now: later, fetch: recorded.send }), 1)
    delivery = await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: id })
    assert.equal(delivery.state, "delivered")
    assert.equal(delivery.attempts, 2)
    assert.equal(recorded.calls.length, 2)
  })

  await t.test("exhausted retries become dead and stay inspectable", async () => {
    const db = memoryDatabase()
    const id = new ObjectId().toString()
    let now = new Date("2026-11-26T00:00:00.000Z")
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne(pendingDelivery(id, now))
    const recorded = recordingFetch(new Response("unavailable", { status: 500 }))
    for (let attempt = 1; attempt <= PUBLISH_WEBHOOK_MAX_ATTEMPTS; attempt += 1) {
      assert.equal(await deliver(db, { now, fetch: recorded.send, limit: 1 }), 0)
      const delivery = await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: id })
      assert.equal(delivery.attempts, attempt)
      assert.match(delivery.lastError, /^HTTP 500/)
      if (attempt < PUBLISH_WEBHOOK_MAX_ATTEMPTS) {
        assert.equal(delivery.state, "pending")
        now = new Date(delivery.nextAttemptAt)
      } else {
        assert.equal(delivery.state, "dead")
      }
    }
    assert.equal(await deliver(db, { now, fetch: recorded.send }), 0)
    assert.equal(recorded.calls.length, PUBLISH_WEBHOOK_MAX_ATTEMPTS)
  })

  await t.test("a restarted worker reclaims an expired lease and does not steal an active one", async () => {
    const db = memoryDatabase()
    const expiredId = new ObjectId().toString()
    const activeId = new ObjectId().toString()
    const now = new Date("2026-11-26T00:01:00.000Z")
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne({
      ...pendingDelivery(expiredId, new Date("2026-11-26T00:00:00.000Z")),
      state: "leased",
      attempts: 2,
      leaseOwner: "worker-old",
      leaseUntil: new Date("2026-11-26T00:00:30.000Z"),
    })
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne({
      ...pendingDelivery(activeId, new Date("2026-11-26T00:00:00.000Z")),
      state: "leased",
      attempts: 1,
      leaseOwner: "worker-active",
      leaseUntil: new Date("2026-11-26T00:01:30.000Z"),
    })
    const recorded = recordingFetch(new Response(null, { status: 204 }))
    assert.equal(await deliver(db, { now, fetch: recorded.send, workerId: "worker-new" }), 1)
    assert.deepEqual(recorded.calls.map((call) => JSON.parse(call.body).submissionId), [expiredId])
    assert.equal((await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: expiredId })).state, "delivered")
    const active = await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: activeId })
    assert.equal(active.state, "leased")
    assert.equal(active.leaseOwner, "worker-active")
    assert.equal(active.attempts, 1)
  })

  await t.test("the earliest due delivery is sent first", async () => {
    const db = memoryDatabase()
    const later = new ObjectId().toString()
    const earlier = new ObjectId().toString()
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne(pendingDelivery(later, new Date("2026-11-26T00:05:00.000Z")))
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne(pendingDelivery(earlier, new Date("2026-11-26T00:01:00.000Z")))
    const recorded = recordingFetch(new Response(null, { status: 204 }))
    assert.equal(await deliver(db, { now: new Date("2026-11-26T00:10:00.000Z"), fetch: recorded.send, limit: 1 }), 1)
    assert.equal(JSON.parse(recorded.calls[0].body).submissionId, earlier)
  })

  await t.test("delivery waits until development has an HTTPS endpoint and a secret", async () => {
    const db = memoryDatabase()
    const id = new ObjectId().toString()
    const now = new Date("2026-11-26T00:00:00.000Z")
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne(pendingDelivery(id, now))
    const recorded = recordingFetch(new Response(null, { status: 204 }))
    assert.equal(await deliver(db, { now, fetch: recorded.send, development: false }), 0)
    assert.equal(await deliver(db, { now, fetch: recorded.send, secret: "" }), 0)
    assert.equal(await deliver(db, { now, fetch: recorded.send, url: "http://bot.example/hook" }), 0)
    assert.equal(await deliver(db, { now, fetch: recorded.send, url: "not a url" }), 0)
    assert.equal(recorded.calls.length, 0)
    const delivery = await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: id })
    assert.equal(delivery.state, "pending")
    assert.equal(delivery.attempts, 0)
  })

  await t.test("a network failure is recorded and the submission stays accepted", async () => {
    const db = memoryDatabase()
    const id = new ObjectId().toString()
    const now = new Date("2026-11-26T00:00:00.000Z")
    await db.collection(SUBMISSIONS_COLLECTION).insertOne({ _id: id, status: "pending" })
    await db.collection(PUBLISH_WEBHOOK_COLLECTION).insertOne(pendingDelivery(id, now))
    const recorded = recordingFetch(new Error(`connect failed ${WEBHOOK_SECRET}`))
    assert.equal(await deliver(db, { now, fetch: recorded.send }), 0)
    const delivery = await db.collection(PUBLISH_WEBHOOK_COLLECTION).findOne({ eventId: id })
    assert.equal(delivery.state, "pending")
    assert.equal(delivery.lastError, "connect failed [redacted]")
    assert.equal((await db.collection(SUBMISSIONS_COLLECTION).findOne({ _id: id })).status, "pending")
  })

  await t.test("the development stack owns webhook startup and the publish route", async () => {
    const route = await readFile(new URL("../apps/web/app/api/projects/route.ts", import.meta.url), "utf8")
    const resubmit = await readFile(new URL("../apps/web/app/api/submissions/[id]/resubmit/route.ts", import.meta.url), "utf8")
    const dev = await readFile(new URL("../scripts/dev.ps1", import.meta.url), "utf8")
    const stop = await readFile(new URL("../scripts/stop.ps1", import.meta.url), "utf8")
    const worker = await readFile(new URL("../scripts/process-publish-webhooks.mjs", import.meta.url), "utf8")
    assert.match(route, /process\.env\.NODE_ENV === "development" \? mongoClient : undefined/)
    assert.match(resubmit, /notify: process\.env\.NODE_ENV === "development"/)
    assert.match(dev, /process-publish-webhooks\.mjs/)
    assert.match(dev, /publish-webhook/)
    assert.match(dev, /notifications:work/)
    assert.match(dev, /'--watch'/)
    assert.match(dev, /\$env:NODE_ENV = 'development'/)
    assert.match(stop, /publish-webhook/)
    assert.match(stop, /notifications/)
    assert.match(worker, /NODE_ENV !== "development"/)
    assert.match(worker, /deliverPublishWebhooks/)
  })
})
