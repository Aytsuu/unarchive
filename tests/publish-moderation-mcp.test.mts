import assert from "node:assert/strict"
import { createServer } from "node:http"
import { readFile } from "node:fs/promises"
import test from "node:test"
import { ObjectId } from "mongodb"
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client"
import { MODERATION_BOT_ID, PENDING_SUBMISSION_LIMIT, createDevelopmentOnlyHandlers, createPublishModerationHandler } from "../apps/web/lib/mcp/publish-moderation.ts"

function compareValues(left, right) {
  const value = (item) => item instanceof Date ? item.getTime() : item?.toString && item.toString !== Object.prototype.toString ? String(item) : item
  const a = value(left)
  const b = value(right)
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
  return Object.entries(filter).every(([key, value]) => {
    if (value && typeof value === "object" && "$in" in value) return value.$in.some((candidate) => same(item[key], candidate))
    return same(item[key], value)
  })
}

function memoryDatabase() {
  const collections = new Map()
  const documents = (name) => {
    if (!collections.has(name)) collections.set(name, [])
    return collections.get(name)
  }
  return {
    collection(name) {
      const docs = documents(name)
      return {
        async createIndex() {},
        async updateOne(filter, update) {
          const doc = docs.find((item) => matches(item, filter))
          if (!doc) return { matchedCount: 0 }
          if (update.$set) Object.assign(doc, update.$set)
          return { matchedCount: 1 }
        },
        async findOne(filter) {
          return docs.find((item) => matches(item, filter)) ?? null
        },
        find(filter) {
          let rows = docs.filter((item) => matches(item, filter))
          const cursor = {
            sort(spec) {
              rows = [...rows].sort((left, right) => {
                for (const [key, direction] of Object.entries(spec)) {
                  const compared = compareValues(left[key], right[key])
                  if (compared !== 0) return compared * direction
                }
                return 0
              })
              return cursor
            },
            limit(count) {
              rows = rows.slice(0, count)
              return cursor
            },
            async toArray() { return rows },
          }
          return cursor
        },
        async insertOne(document) {
          if (document._id && docs.some((item) => same(item._id, document._id))) {
            const error = new Error("duplicate")
            error.code = 11000
            throw error
          }
          docs.push(document)
        },
        async insertMany(items) { for (const item of items) docs.push(item) },
        aggregate(pipeline) {
          const ids = pipeline?.[0]?.$match?.$expr?.$in?.[1] ?? []
          const rows = docs.filter((doc) => ids.some((id) => String(doc._id) === String(id)))
          return { async toArray() { return rows.map((doc) => ({ _id: doc._id, name: doc.name })) } }
        },
      }
    },
  }
}

function sessionClient() {
  return {
    sessions: 0,
    startSession() {
      this.sessions += 1
      return { async withTransaction(work) { return work() }, async endSession() {} }
    },
  }
}

function failingClient() {
  return {
    startSession() {
      return { async withTransaction() { throw new Error("database unavailable") }, async endSession() {} }
    },
  }
}

function submission(id, submittedAt, snapshot = {}, ownerId = "owner-1") {
  return {
    _id: id,
    ownerId,
    status: "pending",
    submittedAt,
    snapshot: {
      projectType: "thesis",
      title: "Project",
      description: "",
      abstract: "",
      institution: "",
      topics: [],
      contributors: [],
      links: [],
      dateStarted: "",
      dateEnded: "",
      demos: [],
      ...snapshot,
    },
  }
}

function textOf(result) {
  const block = result.content?.find((item) => item.type === "text")
  return block?.text ?? ""
}

async function withServer(nodeEnv, deps, run) {
  const endpoint = createDevelopmentOnlyHandlers(createPublishModerationHandler(deps), { NODE_ENV: nodeEnv })
  const server = createServer(async (req, res) => {
    try {
      const method = req.method || "GET"
      const respond = endpoint[method]
      if (!respond) {
        res.writeHead(405)
        res.end()
        return
      }
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) {
        if (value === undefined || ["host", "connection", "content-length", "transfer-encoding"].includes(key)) continue
        if (Array.isArray(value)) for (const item of value) headers.append(key, item)
        else headers.set(key, value)
      }
      const request = new Request(`http://127.0.0.1${req.url}`, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : Buffer.concat(chunks),
      })
      const response = await respond(request)
      const body = Buffer.from(await response.arrayBuffer())
      const responseHeaders = {}
      response.headers.forEach((value, key) => { responseHeaders[key] = value })
      res.writeHead(response.status, responseHeaders)
      res.end(body)
    } catch (error) {
      res.writeHead(500)
      res.end(error instanceof Error ? error.message : "request failed")
    }
  })
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const address = server.address()
  const port = typeof address === "object" && address ? address.port : 0
  const url = new URL(`http://127.0.0.1:${port}/api/mcp`)
  const clients = []
  const connect = async () => {
    const client = new Client({ name: "publish-moderation-test", version: "1.0.0" })
    clients.push(client)
    await client.connect(new StreamableHTTPClientTransport(url))
    return client
  }
  try {
    await run(connect)
  } finally {
    await Promise.all(clients.map((client) => client.close().catch(() => {})))
    server.closeAllConnections?.()
    await new Promise((resolve) => server.close(resolve))
  }
}

async function withClient(nodeEnv, deps, run) {
  await withServer(nodeEnv, deps, async (connect) => {
    await run(await connect())
  })
}

test("publish moderation mcp", async (t) => {
  await t.test("initialization, discovery, and an empty queue use the MCP client", async () => {
    const invalidated = []
    await withClient("development", { db: memoryDatabase(), client: sessionClient(), invalidateProjectList() { invalidated.push("list") } }, async (client) => {
      assert.equal(client.getServerVersion()?.name, "unarchive-publish-moderation")
      assert.match(client.getInstructions() ?? "", new RegExp(MODERATION_BOT_ID))
      assert.match(client.getInstructions() ?? "", new RegExp(String(PENDING_SUBMISSION_LIMIT)))
      const listed = await client.listTools()
      assert.deepEqual(listed.tools.map((tool) => tool.name).sort(), ["approve_submission", "get_pending_submission", "list_pending_submissions", "request_submission_revision"])
      const result = await client.callTool({ name: "list_pending_submissions", arguments: {} })
      assert.equal(result.isError, undefined)
      assert.deepEqual(result.structuredContent, { submissions: [] })
      assert.equal(invalidated.length, 0)
    })
  })

  await t.test("pending review details include abstracts, topics, contributors, links, and dates", async () => {
    const db = memoryDatabase()
    const id = new ObjectId()
    const hidden = new ObjectId()
    await db.collection("user").insertOne({ _id: "owner-1", name: "Elena Cruz" })
    await db.collection("projectSubmissions").insertOne(submission(id, new Date("2026-11-20T12:00:00.000Z"), {
      title: "Coastal Mangrove Recovery After Aquaculture Retreat",
      description: "Tracks how retired ponds return to mangrove cover.",
      abstract: "Retired aquaculture ponds were surveyed for seedling survival.",
      institution: "University of the Philippines Visayas",
      topics: ["Environment & Sustainability", "Agriculture & Food"],
      contributors: ["Elena Cruz"],
      links: ["https://example.com/mangrove-recovery"],
      dateStarted: "2023-06",
      dateEnded: "2025-03",
    }))
    await db.collection("projectSubmissions").insertOne(submission(hidden, new Date("2026-11-21T12:00:00.000Z"), { title: "Already decided" }, "owner-2"))
    await db.collection("projectSubmissions").updateOne({ _id: hidden }, { $set: { status: "approved" } })
    await withClient("development", { db, client: sessionClient(), invalidateProjectList() {} }, async (client) => {
      const result = await client.callTool({ name: "list_pending_submissions", arguments: {} })
      assert.equal(result.isError, undefined)
      assert.deepEqual(result.structuredContent, { submissions: [{
        id: id.toString(),
        title: "Coastal Mangrove Recovery After Aquaculture Retreat",
        description: "Tracks how retired ponds return to mangrove cover.",
        institution: "University of the Philippines Visayas",
        ownerName: "Elena Cruz",
        submittedAt: "2026-11-20T12:00:00.000Z",
        status: "pending",
        revisionReason: "",
        decidedAt: "",
        abstract: "Retired aquaculture ponds were surveyed for seedling survival.",
        topics: ["Environment & Sustainability", "Agriculture & Food"],
        contributors: ["Elena Cruz"],
        links: ["https://example.com/mangrove-recovery"],
        dateStarted: "2023-06",
        dateEnded: "2025-03",
      }] })
    })
  })

  await t.test("the queue keeps the oldest pending submissions and names a missing owner Member", async () => {
    const db = memoryDatabase()
    const ids = []
    for (let index = 0; index < PENDING_SUBMISSION_LIMIT + 1; index += 1) {
      const id = new ObjectId()
      ids.push(id)
      await db.collection("projectSubmissions").insertOne(submission(id, new Date(Date.UTC(2026, 0, 1, 0, 0, index)), { title: `Submission ${index}` }, "owner-missing"))
    }
    await withClient("development", { db, client: sessionClient(), invalidateProjectList() {} }, async (client) => {
      const result = await client.callTool({ name: "list_pending_submissions", arguments: {} })
      const submissions = result.structuredContent.submissions
      assert.equal(submissions.length, PENDING_SUBMISSION_LIMIT)
      assert.equal(submissions[0].title, "Submission 0")
      assert.equal(submissions[0].ownerName, "Member")
      assert.equal(submissions.at(-1).title, `Submission ${PENDING_SUBMISSION_LIMIT - 1}`)
      assert.equal(submissions.some((item) => item.id === ids.at(-1).toString()), false)
    })
  })

  await t.test("get_pending_submission returns one submission, including one outside the queue", async () => {
    const db = memoryDatabase()
    const ids = []
    for (let index = 0; index < PENDING_SUBMISSION_LIMIT + 1; index += 1) {
      const id = new ObjectId()
      ids.push(id)
      await db.collection("projectSubmissions").insertOne(submission(id, new Date(Date.UTC(2026, 0, 1, 0, 0, index)), {
        title: `Submission ${index}`,
        abstract: index === PENDING_SUBMISSION_LIMIT ? "Held outside the queue" : "",
        topics: ["Environment & Sustainability"],
        contributors: ["Elena Cruz"],
        links: ["https://example.com/outside"],
        dateStarted: "2024-01",
        dateEnded: "2025-02",
      }, "owner-missing"))
    }
    const outside = ids.at(-1)
    await withClient("development", { db, client: sessionClient(), invalidateProjectList() {} }, async (client) => {
      const listed = await client.callTool({ name: "list_pending_submissions", arguments: {} })
      assert.equal(listed.structuredContent.submissions.some((item) => item.id === outside.toString()), false)
      const result = await client.callTool({ name: "get_pending_submission", arguments: { id: outside.toString().toUpperCase() } })
      assert.equal(result.isError, undefined)
      assert.equal(result.structuredContent.id, outside.toString())
      assert.equal(result.structuredContent.title, `Submission ${PENDING_SUBMISSION_LIMIT}`)
      assert.equal(result.structuredContent.status, "pending")
      assert.equal(result.structuredContent.abstract, "Held outside the queue")
      assert.deepEqual(result.structuredContent.topics, ["Environment & Sustainability"])
      assert.equal(result.structuredContent.ownerName, "Member")
      const missing = await client.callTool({ name: "get_pending_submission", arguments: { id: new ObjectId().toString() } })
      assert.equal(missing.isError, true)
      assert.equal(textOf(missing), "No submission exists with that id.")
      const invalid = await client.callTool({ name: "get_pending_submission", arguments: { id: "not-an-id" } })
      assert.equal(invalid.isError, true)
      assert.match(textOf(invalid), /24-character hexadecimal/)
    })
  })

  await t.test("get_pending_submission rejects a submission that was already decided", async () => {
    const db = memoryDatabase()
    const id = new ObjectId()
    await db.collection("projectSubmissions").insertOne(submission(id, new Date("2026-11-21T01:00:00.000Z"), { title: "Already published" }))
    await db.collection("projectSubmissions").updateOne({ _id: id }, { $set: { status: "approved", decidedAt: new Date("2026-11-21T02:00:00.000Z") } })
    await withClient("development", { db, client: sessionClient(), invalidateProjectList() {} }, async (client) => {
      const result = await client.callTool({ name: "get_pending_submission", arguments: { id: id.toString() } })
      assert.equal(result.isError, true)
      assert.equal(textOf(result), "This submission has already been decided.")
    })
  })

  await t.test("approval publishes, notifies, attributes the bot, and invalidates the project list", async () => {
    const db = memoryDatabase()
    const client = sessionClient()
    const id = new ObjectId()
    const invalidated = []
    await db.collection("projectSubmissions").insertOne(submission(id, new Date("2026-11-21T01:00:00.000Z"), {
      title: "Barangay clinic scheduling study",
      description: "A scheduling study",
      contributors: ["Alex Rivera"],
      links: ["https://example.com/clinic"],
    }))
    await withClient("development", { db, client, invalidateProjectList() { invalidated.push(id.toString()) } }, async (mcp) => {
      const result = await mcp.callTool({ name: "approve_submission", arguments: { id: id.toString() } })
      assert.equal(result.isError, undefined)
      assert.deepEqual(result.structuredContent, { id: id.toString(), status: "approved" })
      assert.match(textOf(result), /Approved submission/)
    })
    const stored = await db.collection("projectSubmissions").findOne({ _id: id })
    assert.equal(stored.status, "approved")
    assert.equal(stored.decidedBy, MODERATION_BOT_ID)
    assert.equal(stored.revisionReason, undefined)
    const project = await db.collection("projects").findOne({ _id: id })
    assert.equal(project.title, "Barangay clinic scheduling study")
    assert.equal(project.ownerId, "owner-1")
    const version = await db.collection("projectVersions").findOne({ projectId: id, version: 1 })
    assert.equal(version.kind, "published")
    const event = await db.collection("notificationEvents").findOne({ eventId: `project.publish_approved:${id}` })
    assert.equal(event.type, "project.publish_approved")
    assert.equal(event.actorId, MODERATION_BOT_ID)
    assert.equal(event.recipientId, "owner-1")
    assert.equal(event.state, "pending")
    assert.deepEqual(invalidated, [id.toString()])
  })

  await t.test("a revision stores the reason, notifies the owner, and leaves the list cache alone", async () => {
    const db = memoryDatabase()
    const id = new ObjectId()
    const invalidated = []
    await db.collection("projectSubmissions").insertOne(submission(id, new Date("2026-11-21T01:00:00.000Z"), { title: "Needs a method" }))
    await withClient("development", { db, client: sessionClient(), invalidateProjectList() { invalidated.push("list") } }, async (mcp) => {
      const result = await mcp.callTool({ name: "request_submission_revision", arguments: { id: id.toString().toUpperCase(), reason: "  Explain the sample size.  " } })
      assert.equal(result.isError, undefined)
      assert.deepEqual(result.structuredContent, { id: id.toString(), status: "changes_requested" })
    })
    const stored = await db.collection("projectSubmissions").findOne({ _id: id })
    assert.equal(stored.status, "changes_requested")
    assert.equal(stored.revisionReason, "Explain the sample size.")
    assert.equal(stored.decidedBy, MODERATION_BOT_ID)
    assert.equal(await db.collection("projects").findOne({ _id: id }), null)
    const event = await db.collection("notificationEvents").findOne({ eventId: `project.revision_requested:${id}` })
    assert.equal(event.actorId, MODERATION_BOT_ID)
    assert.equal(event.recipientId, "owner-1")
    assert.equal(invalidated.length, 0)
  })

  await t.test("a revision reason of 4000 characters is accepted and a longer one is not", async () => {
    const db = memoryDatabase()
    const client = sessionClient()
    const id = new ObjectId()
    await db.collection("projectSubmissions").insertOne(submission(id, new Date("2026-11-21T01:00:00.000Z")))
    const reason = "a".repeat(4000)
    await withClient("development", { db, client, invalidateProjectList() {} }, async (mcp) => {
      const tooLong = await mcp.callTool({ name: "request_submission_revision", arguments: { id: id.toString(), reason: `${reason}b` } })
      assert.equal(tooLong.isError, true)
      assert.match(textOf(tooLong), /at most 4000 characters/)
      const blank = await mcp.callTool({ name: "request_submission_revision", arguments: { id: id.toString(), reason: "   " } })
      assert.equal(blank.isError, true)
      assert.match(textOf(blank), /revision reason is required/i)
      const accepted = await mcp.callTool({ name: "request_submission_revision", arguments: { id: id.toString(), reason } })
      assert.equal(accepted.isError, undefined)
    })
    const stored = await db.collection("projectSubmissions").findOne({ _id: id })
    assert.equal(stored.revisionReason, reason)
    assert.equal(client.sessions, 1)
  })

  await t.test("malformed ids, missing submissions, and repeated decisions are tool errors", async () => {
    const db = memoryDatabase()
    const client = sessionClient()
    const id = new ObjectId()
    const missing = new ObjectId()
    await db.collection("projectSubmissions").insertOne(submission(id, new Date("2026-11-21T01:00:00.000Z"), { title: "Once" }))
    await withClient("development", { db, client, invalidateProjectList() {} }, async (mcp) => {
      const malformed = await mcp.callTool({ name: "approve_submission", arguments: { id: "not-an-id" } })
      assert.equal(malformed.isError, true)
      assert.match(textOf(malformed), /24-character hexadecimal/)
      const absent = await mcp.callTool({ name: "approve_submission", arguments: { id: missing.toString() } })
      assert.equal(absent.isError, true)
      assert.equal(textOf(absent), "No submission exists with that id.")
      const approved = await mcp.callTool({ name: "approve_submission", arguments: { id: id.toString() } })
      assert.equal(approved.isError, undefined)
      const repeated = await mcp.callTool({ name: "approve_submission", arguments: { id: id.toString() } })
      assert.equal(repeated.isError, true)
      assert.equal(textOf(repeated), "This submission has already been decided.")
      const revised = await mcp.callTool({ name: "request_submission_revision", arguments: { id: id.toString(), reason: "Too late" } })
      assert.equal(revised.isError, true)
      assert.equal(textOf(revised), "This submission has already been decided.")
    })
    const stored = await db.collection("projectSubmissions").findOne({ _id: id })
    assert.equal(stored.status, "approved")
    assert.equal(stored.decidedBy, MODERATION_BOT_ID)
    assert.equal(client.sessions, 4)
  })

  await t.test("concurrent decisions leave a single publication and one notification", async () => {
    const db = memoryDatabase()
    const id = new ObjectId()
    let reads = 0
    let release
    const bothRead = new Promise((resolve) => { release = resolve })
    const submissions = db.collection("projectSubmissions")
    const findOne = submissions.findOne
    submissions.findOne = async (filter, options) => {
      const record = await findOne(filter, options)
      if (filter?._id && filter.status === undefined) {
        reads += 1
        if (reads === 2) release()
        await bothRead
      }
      return record
    }
    await submissions.insertOne(submission(id, new Date("2026-11-21T01:00:00.000Z"), { title: "One decision" }))
    const invalidated = []
    await withServer("development", { db, client: sessionClient(), invalidateProjectList() { invalidated.push("list") } }, async (connect) => {
      const [approve, revise] = await Promise.all([connect(), connect()])
      const results = await Promise.race([
        Promise.all([
          approve.callTool({ name: "approve_submission", arguments: { id: id.toString() } }),
          revise.callTool({ name: "request_submission_revision", arguments: { id: id.toString(), reason: "Hold on" } }),
        ]),
        new Promise((_, reject) => setTimeout(() => reject(new Error("decision barrier timed out")), 3000)),
      ])
      const failures = results.filter((result) => result.isError)
      const successes = results.filter((result) => !result.isError)
      assert.equal(failures.length, 1)
      assert.equal(successes.length, 1)
      assert.equal(textOf(failures[0]), "This submission has already been decided.")
    })
    const stored = await db.collection("projectSubmissions").findOne({ _id: id })
    assert.equal(stored.decidedBy, MODERATION_BOT_ID)
    assert.equal([stored.status === "approved", stored.status === "changes_requested"].filter(Boolean).length, 1)
    assert.equal(invalidated.length, stored.status === "approved" ? 1 : 0)
    const projects = await db.collection("projects").find({}).toArray()
    assert.equal(projects.length, stored.status === "approved" ? 1 : 0)
    const events = await db.collection("notificationEvents").find({}).toArray()
    assert.equal(events.length, 1)
    assert.equal(events[0].actorId, MODERATION_BOT_ID)
  })

  await t.test("a decision service failure stays a tool error and does not refresh the list", async () => {
    const db = memoryDatabase()
    const id = new ObjectId()
    const invalidated = []
    await db.collection("projectSubmissions").insertOne(submission(id, new Date("2026-11-21T01:00:00.000Z"), { title: "Unreachable" }))
    const dbError = memoryDatabase()
    await withClient("development", { db, client: failingClient(), invalidateProjectList() { invalidated.push("list") } }, async (mcp) => {
      const failed = await mcp.callTool({ name: "approve_submission", arguments: { id: id.toString() } })
      assert.equal(failed.isError, true)
      assert.equal(textOf(failed), "The submission could not be decided.")
      assert.equal(textOf(failed).includes("database unavailable"), false)
      const list = await mcp.callTool({ name: "list_pending_submissions", arguments: {} })
      assert.equal(list.isError, undefined)
    })
    await withClient("development", { db: dbError, client: sessionClient(), invalidateProjectList() {} }, async (mcp) => {
      dbError.collection = () => { throw new Error("timeout talking to the database") }
      const listed = await mcp.callTool({ name: "list_pending_submissions", arguments: {} })
      assert.equal(listed.isError, true)
      assert.equal(textOf(listed), "Pending submissions could not be loaded.")
      assert.equal(textOf(listed).includes("timeout"), false)
    })
    const stored = await db.collection("projectSubmissions").findOne({ _id: id })
    assert.equal(stored.status, "pending")
    assert.equal(await db.collection("projects").findOne({ _id: id }), null)
    assert.equal(await db.collection("notificationEvents").findOne({}), null)
    assert.equal(invalidated.length, 0)
  })

  await t.test("cache invalidation failure still reports the approval", async () => {
    const db = memoryDatabase()
    const id = new ObjectId()
    await db.collection("projectSubmissions").insertOne(submission(id, new Date("2026-11-21T01:00:00.000Z"), { title: "Published anyway" }))
    await withClient("development", { db, client: sessionClient(), invalidateProjectList() { throw new Error("cache down") } }, async (mcp) => {
      const result = await mcp.callTool({ name: "approve_submission", arguments: { id: id.toString() } })
      assert.equal(result.isError, undefined)
      assert.equal(result.structuredContent.status, "approved")
    })
    assert.equal((await db.collection("projectSubmissions").findOne({ _id: id })).status, "approved")
  })

  await t.test("the endpoint returns 404 outside development", async () => {
    const opened = []
    const handlers = createDevelopmentOnlyHandlers(async () => {
      opened.push("open")
      return new Response("open", { status: 200 })
    }, { NODE_ENV: "production" })
    for (const method of ["GET", "POST", "DELETE"]) {
      const response = await handlers[method](new Request("http://127.0.0.1/api/mcp", { method }))
      assert.equal(response.status, 404)
      assert.equal(await response.text(), "")
    }
    assert.equal(opened.length, 0)
    const development = createDevelopmentOnlyHandlers(async () => new Response("open"), { NODE_ENV: "development" })
    assert.equal((await development.POST(new Request("http://127.0.0.1/api/mcp", { method: "POST" }))).status, 200)
    await assert.rejects(() => withClient("production", { db: memoryDatabase(), client: sessionClient(), invalidateProjectList() {} }, async () => {}))
  })

  await t.test("the web route mounts the development handler and invalidates the project list", async () => {
    const source = await readFile(new URL("../apps/web/app/api/mcp/route.ts", import.meta.url), "utf8")
    assert.match(source, /createDevelopmentOnlyHandlers\(createPublishModerationHandler\(/)
    assert.match(source, /revalidateTag\(PROJECT_LIST_TAG/)
    assert.match(source, /await connection\(\)/)
    assert.match(source, /export async function GET/)
    assert.match(source, /export async function POST/)
    assert.match(source, /export async function DELETE/)
  })
})
