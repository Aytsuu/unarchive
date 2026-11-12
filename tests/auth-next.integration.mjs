import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { createServer as createHttpServer } from "node:http"
import { createServer as createNetServer } from "node:net"
import { setTimeout as delay } from "node:timers/promises"
import { test } from "node:test"
import { MongoClient } from "mongodb"
import { initializeProjectsCollection } from "../scripts/init-projects.mjs"

// Run after `npm run build` with:
// node --env-file=.env.local --test tests/auth-next.integration.mjs
// All email is sent exclusively to the loopback mock and the OTP stays in memory.
test("Next signup sends an OTP and verification establishes the onboarding session", { timeout: 60_000 }, async () => {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error("MONGODB_URI is required")
  const databaseName = `auth_next_test_${randomUUID().replaceAll("-", "")}`
  const mongo = new MongoClient(uri)
  const email = `test-${randomUUID()}@example.invalid`
  const messages = []
  let child
  let server

  try {
    await mongo.connect()
    await initializeProjectsCollection(mongo.db(databaseName))
    server = createHttpServer(async (req, res) => {
      if (req.method !== "POST" || req.url !== "/emails") {
        res.writeHead(404).end()
        return
      }
      let body = ""
      for await (const chunk of req) body += chunk
      try {
        const message = JSON.parse(body)
        const recipients = Array.isArray(message.to) ? message.to : [message.to]
        if (recipients.length !== 1 || recipients[0] !== email) throw new Error("Unexpected mock recipient")
        messages.push(message)
        res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: randomUUID() }))
      } catch {
        res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "Invalid test request" }))
      }
    })
    await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve))
    const mockPort = server.address().port
    const freePortServer = createNetServer()
    await new Promise((resolve, reject) => freePortServer.once("error", reject).listen(0, "127.0.0.1", resolve))
    const appPort = freePortServer.address().port
    await new Promise((resolve, reject) => freePortServer.close((error) => error ? reject(error) : resolve()))
    const origin = `http://127.0.0.1:${appPort}`

    child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-p", String(appPort), "-H", "127.0.0.1"], {
      cwd: process.cwd(), windowsHide: true, stdio: "ignore",
      env: {
        ...process.env,
        MONGODB_DB_NAME: databaseName,
        MONGO_ENABLE_TRANSACTIONS: "false",
        BETTER_AUTH_SECRET: "integration-test-secret-only-0123456789abcdef",
        BETTER_AUTH_URL: origin,
        PROJECT_VIEWS_TRUST_PROXY_HEADER: "x-test-client-ip",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        RESEND_API_KEY: "re_test_mock_only",
        RESEND_BASE_URL: `http://127.0.0.1:${mockPort}`,
        EMAIL_FROM: "Test <test@example.invalid>",
        RESEND_DEBUG: "false",
        R2_ACCOUNT_ID: "00000000000000000000000000000000",
        R2_ACCESS_KEY_ID: "test-only",
        R2_SECRET_ACCESS_KEY: "test-only",
        R2_BUCKET_NAME: "test-only-bucket",
      },
    })
    let ready = false
    for (let attempt = 0; attempt < 100 && !ready; attempt++) {
      if (child.exitCode !== null) throw new Error("Test Next server exited before becoming ready")
      try { ready = (await fetch(`${origin}/login`)).ok } catch { /* Wait for the local server. */ }
      if (!ready) await delay(200)
    }
    assert.ok(ready, "local Next server must start")
    assert.equal((await fetch(`${origin}/api/dev/autofill`)).status, 404, "development defaults must not be exposed in production")
    assert.equal((await fetch(`${origin}/api/dev/autofill/image/example.png`)).status, 404, "development fixtures must not be exposed in production")
    assert.doesNotMatch(await (await fetch(`${origin}/login`)).text(), /data-dev-autofill/, "the development toolbar must not render in production")
    const guestMe = await fetch(`${origin}/api/me`)
    assert.equal(guestMe.status, 401)
    const guestProject = await fetch(`${origin}/api/projects`, { method: "POST", headers: { origin }, body: new FormData() })
    assert.equal(guestProject.status, 401)
    assert.equal((await fetch(`${origin}/api/projects/search?q=test`)).status, 401, "reference search requires authentication")
    const guestHome = await fetch(`${origin}/home`)
    assert.equal(guestHome.status, 200)
    const guestHomeHtml = await guestHome.text()
    assert.match(guestHomeHtml, /Guest/)
    assert.match(guestHomeHtml, /Topics/)
    assert.match(guestHomeHtml, /AI &amp; Data Science/)
    assert.match(guestHomeHtml, /aria-label="Search projects"/)
    const guestPublish = await fetch(`${origin}/publish`, { redirect: "manual" })
    if (guestPublish.status === 200) {
      assert.match(await guestPublish.text(), /<meta[^>]*http-equiv="refresh"[^>]*url=\/login/)
    } else {
      assert.equal(guestPublish.status, 307)
      assert.match(guestPublish.headers.get("location"), /\/login/)
    }
    const post = (path, body) => fetch(`${origin}/api/auth${path}`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    const signup = await post("/sign-up/email", { name: "Test User", email, password: "Only-for-this-test-7319!" })
    assert.equal(signup.status, 200)
    assert.equal(signup.headers.getSetCookie().some((cookie) => /session_token/i.test(cookie)), false)
    for (let attempt = 0; attempt < 100 && !messages.length; attempt++) await delay(100)
    assert.equal(messages.length, 1, "signup must schedule exactly one verification email")
    await mongo.db(databaseName).collection("verificationResendCooldown").updateMany({}, { $set: { expiresAt: new Date(Date.now() - 1000) } })
    const retry = await post("/sign-up/email", { name: "Test User", email, password: "Only-for-this-test-7319!" })
    assert.equal(retry.status, 200)
    for (let attempt = 0; attempt < 100 && messages.length < 2; attempt++) await delay(100)
    assert.equal(messages.length, 2, "repeated unverified signup after cooldown must send a fresh email")
    const code = String(messages[1].text).match(/\b\d{6}\b/)?.[0]
    assert.ok(code, "mock email contains a six-digit OTP")
    const verification = await post("/email-otp/verify-email", { email, otp: code })
    assert.equal(verification.status, 200)
    const sessionCookie = verification.headers.getSetCookie().find((cookie) => /session_token/i.test(cookie))
    assert.ok(sessionCookie && /httponly/i.test(sessionCookie))
    const session = await fetch(`${origin}/api/auth/get-session`, { headers: { cookie: sessionCookie.split(";")[0] } })
    assert.equal(session.status, 200)
    const sessionData = await session.json()
    assert.equal(sessionData.user.email, email)
    const me = await fetch(`${origin}/api/me`, { headers: { cookie: sessionCookie.split(";")[0] } })
    assert.equal(me.status, 200)
    assert.equal((await me.json()).user.email, email)
    const home = await fetch(`${origin}/home`, { headers: { cookie: sessionCookie.split(";")[0] } })
    assert.equal(home.status, 200)
    assert.match(await home.text(), /Publish/)
    const publish = await fetch(`${origin}/publish`, { headers: { cookie: sessionCookie.split(";")[0] } })
    assert.equal(publish.status, 200)
    assert.match(await publish.text(), /Share Your Work/)
    const profile = await fetch(`${origin}/profile`, { headers: { cookie: sessionCookie.split(";")[0] } })
    assert.equal(profile.status, 200)
    assert.match(await profile.text(), /Test User/)
    const project = { title: "Integration test project", description: "Test description", abstract: "Test abstract", institution: "Test university", dateStarted: "2023-02", dateEnded: "2024-11", topics: ["AI & Data Science", "Health & Medicine"], links: ["https://example.com"], contributors: ["Test User"], consents: { permission: true, contributorsPermission: true, detailsAccurate: true, universityIp: true }, ownerId: "spoofed-owner" }
    const projectForm = (data, demo) => {
      const form = new FormData()
      form.set("project", JSON.stringify(data))
      if (demo) form.append("demos", demo, "demo.png")
      return form
    }
    const publishProject = (data, options = {}) => fetch(`${origin}/api/projects`, {
      method: "POST", headers: { origin: options.origin ?? origin, cookie: sessionCookie.split(";")[0], ...(options.key ? { "Idempotency-Key": options.key } : {}) }, body: projectForm(data, options.demo),
    })
    const badOrigin = await publishProject(project, { origin: "https://evil.example" })
    assert.equal(badOrigin.status, 403, "cross-origin submissions must be rejected")
    const invalid = await publishProject({ ...project, title: " " })
    assert.equal(invalid.status, 400, "project title is required")
    assert.equal((await publishProject({ ...project, consents: { ...project.consents, universityIp: false } })).status, 400, "university IP consent is required")
    assert.equal((await publishProject({ ...project, consents: { permission: true, contributorsPermission: true, detailsAccurate: true } })).status, 400, "missing university IP consent must be rejected")
    const badConsent = await publishProject({ ...project, consents: { ...project.consents, contributorsPermission: false } })
    assert.equal(badConsent.status, 400, "all consents are required")
    assert.equal((await publishProject({ ...project, consents: { ...project.consents, detailsAccurate: false } })).status, 400, "accuracy confirmation is required")
    assert.equal((await publishProject({ ...project, consents: { permission: true, contributorsPermission: true, universityIp: true } })).status, 400, "missing accuracy confirmation must be rejected")
    await mongo.db(databaseName).collection("projectPublishRateLimit").deleteMany({})
    const badLink = await publishProject({ ...project, links: ["javascript:alert(1)"] })
    assert.equal(badLink.status, 400, "unsafe project links must be rejected")
    assert.equal((await publishProject({ ...project, topics: ["Unknown topic"] })).status, 400, "unknown topics must be rejected")
    assert.equal((await publishProject({ ...project, dateStarted: "2023-13" })).status, 400, "invalid project months must be rejected")
    assert.equal((await publishProject({ ...project, dateEnded: "2022-12" })).status, 400, "end month cannot be before start month")
    await mongo.db(databaseName).collection("projectPublishRateLimit").deleteMany({})
    assert.equal((await publishProject({ ...project, referenceProjectIds: ["invalid"] })).status, 400, "malformed references must be rejected")
    assert.equal((await publishProject({ ...project, referenceProjectIds: ["000000000000000000000001"] })).status, 400, "references must identify an existing project")
    await mongo.db(databaseName).collection("projectPublishRateLimit").deleteMany({})
    const fakeImage = await publishProject(project, { demo: new Blob(["not an image"], { type: "image/png" }) })
    assert.equal(fakeImage.status, 400, "invalid images must be rejected without contacting object storage")
    assert.equal(await mongo.db(databaseName).collection("projects").countDocuments(), 0)
    const created = await publishProject(project)
    assert.equal(created.status, 201, "a valid project should be published")
    const result = await created.json()
    assert.equal(result.success, true)
    const saved = await mongo.db(databaseName).collection("projects").findOne({ title: project.title })
    assert.ok(saved)
    assert.equal(saved.ownerId, sessionData.user.id, "the project owner must come from the session")
    assert.equal(saved.consents.detailsAccurate, true, "the accuracy confirmation must be saved")
    assert.equal(saved.consents.universityIp, true, "the university IP consent must be saved")
    assert.equal(saved.abstract, "Test abstract", "the abstract must be saved")
    assert.deepEqual(saved.topics, ["AI & Data Science", "Health & Medicine"], "selected topics must be saved")
    assert.equal(saved.dateStarted, "2023-02", "start month must be saved")
    assert.equal(saved.dateEnded, "2024-11", "end month must be saved")
    assert.equal(saved._id.toString(), result.data.id)
    assert.deepEqual(saved.demos, [])
    const referenceSearch = await fetch(`${origin}/api/projects/search?q=Integration`, { headers: { cookie: sessionCookie.split(";")[0] } })
    assert.equal(referenceSearch.status, 200)
    assert.deepEqual((await referenceSearch.json()).data.projects, [{ id: result.data.id, title: project.title }])
    assert.equal((await fetch(`${origin}/api/projects/search?q=${"a".repeat(101)}`, { headers: { cookie: sessionCookie.split(";")[0] } })).status, 400)
    const key = randomUUID()
    const retriedProject = { ...project, title: "Retry-safe project", referenceProjectIds: [result.data.id, result.data.id.toUpperCase()] }
    const firstAttempt = await publishProject(retriedProject, { key })
    assert.equal(firstAttempt.status, 201)
    const firstId = (await firstAttempt.json()).data.id
    const savedReference = await mongo.db(databaseName).collection("projects").findOne({ title: "Retry-safe project" })
    assert.deepEqual(savedReference.referenceProjectIds, [result.data.id], "references are deduplicated and saved")
    const referencedDetail = await fetch(`${origin}/projects/${firstId}`, { headers: { cookie: sessionCookie.split(";")[0] } })
    const referencedHtml = await referencedDetail.text()
    assert.match(referencedHtml, new RegExp(`href="/projects/${result.data.id}"`), "project details link to its reference")
    assert.match(referencedHtml, /Integration test project/, "reference title is shown")
    const replay = await publishProject(retriedProject, { key })
    assert.equal(replay.status, 201)
    assert.equal((await replay.json()).data.id, firstId, "replay returns the original project")
    const conflict = await publishProject({ ...retriedProject, title: "Changed project" }, { key })
    assert.equal(conflict.status, 409, "a key cannot be reused for changed content")
    const concurrentKey = randomUUID()
    const concurrentProject = { ...project, title: "Concurrent project" }
    const concurrent = await Promise.all([publishProject(concurrentProject, { key: concurrentKey }), publishProject(concurrentProject, { key: concurrentKey })])
    assert.deepEqual(concurrent.map((response) => response.status), [201, 201])
    const concurrentIds = await Promise.all(concurrent.map(async (response) => (await response.json()).data.id))
    assert.equal(concurrentIds[0], concurrentIds[1])
    assert.equal(await mongo.db(databaseName).collection("projects").countDocuments({ title: concurrentProject.title }), 1)
    const browse = await fetch(`${origin}/home`, { headers: { cookie: sessionCookie.split(";")[0] } })
    assert.match(await browse.text(), /Integration test project/)
    const searchResults = await fetch(`${origin}/home?q=Retry-safe`, { headers: { cookie: sessionCookie.split(";")[0] } })
    const searchHtml = await searchResults.text()
    assert.match(searchHtml, /Retry-safe project/)
    assert.doesNotMatch(searchHtml, /Integration test project/)
    const detail = await fetch(`${origin}/projects/${result.data.id}`, { headers: { cookie: sessionCookie.split(";")[0] } })
    assert.equal(detail.status, 200)
    const detailHtml = await detail.text()
    assert.match(detailHtml, /Integration test project/)
    assert.match(detailHtml, /Test abstract/)
    assert.match(detailHtml, /AI &amp; Data Science/)
    assert.match(detailHtml, /Health &amp; Medicine/)
    assert.match(detailHtml, /February 2023/)
    assert.match(detailHtml, /November 2024/)
    const metricsUrl = `${origin}/api/projects/${result.data.id}`
    const metricHeaders = { origin, cookie: sessionCookie.split(";")[0] }
    assert.equal(await mongo.db(databaseName).collection("projectViews").countDocuments(), 0, "server rendering must not count a view")
    assert.equal((await fetch(`${metricsUrl}/stars`, { method: "PUT", headers: { origin } })).status, 401)
    assert.equal((await fetch(`${metricsUrl}/stars`, { method: "PUT", headers: { ...metricHeaders, origin: "https://example.invalid" } })).status, 403)
    const starResponses = await Promise.all(Array.from({ length: 3 }, () => fetch(`${metricsUrl}/stars`, { method: "PUT", headers: metricHeaders })))
    assert.ok(starResponses.every((response) => response.status === 200))
    assert.equal(await mongo.db(databaseName).collection("projectStars").countDocuments(), 1, "concurrent stars are idempotent")
    const viewRequest = (ip = "192.0.2.1") => fetch(`${metricsUrl}/views`, { method: "POST", headers: { ...metricHeaders, "x-test-client-ip": ip } })
    const views = await Promise.all([viewRequest(), viewRequest()])
    assert.ok(views.every((response) => response.status === 200))
    assert.equal(await mongo.db(databaseName).collection("projectViews").countDocuments(), 1, "repeated views from the same IP count once per day")
    assert.equal((await viewRequest()).status, 200)
    assert.equal(await mongo.db(databaseName).collection("projectViews").countDocuments(), 1)
    const markedDetail = await fetch(`${origin}/projects/${result.data.id}`, { headers: { cookie: sessionCookie.split(";")[0] } })
    const markedHtml = await markedDetail.text()
    assert.match(markedHtml, /1 view/)
    assert.match(markedHtml, /aria-pressed="true"/)
    const removedStar = await fetch(`${metricsUrl}/stars`, { method: "DELETE", headers: metricHeaders })
    assert.deepEqual((await removedStar.json()).data, { stars: 0, starred: false })
    assert.equal((await viewRequest("invalid-ip")).status, 503)
    assert.equal((await viewRequest("192.0.2.2")).status, 200)
    assert.equal(await mongo.db(databaseName).collection("projectViews").countDocuments(), 2, "another IP counts separately")
    const guestImage = await fetch(`${origin}/api/projects/${result.data.id}/demos/0`)
    assert.equal(guestImage.status, 401)
    const onboarding = await fetch(`${origin}/get-to-know`, { headers: { cookie: sessionCookie.split(";")[0] }, redirect: "manual" })
    assert.equal(onboarding.status, 200)
    const html = await onboarding.text()
    assert.match(html, /Getting to know you/)
    const afterHeading = html.slice(html.indexOf("Getting to know you"))
    const cards = afterHeading.match(/aria-hidden="true">((?:<div\b[^>]*><\/div>)+)<\/div>/)?.[1]
    assert.ok(cards, "onboarding must render the empty cards")
    assert.equal((cards.match(/<div\b/g) ?? []).length, 5, "onboarding renders five empty cards")
    assert.match(afterHeading, /<a\b[^>]*href="\/home"[^>]*>Skip<\/a>/, "Skip opens home")
    const signout = await fetch(`${origin}/api/auth/sign-out`, {
      method: "POST",
      headers: { origin, cookie: sessionCookie.split(";")[0], "content-type": "application/json" },
      body: "{}",
    })
    assert.equal(signout.status, 200)
    assert.ok(signout.headers.getSetCookie().some((cookie) => /session_token/i.test(cookie) && /max-age=0/i.test(cookie)))
    const afterSignout = await fetch(`${origin}/api/me`, { headers: { cookie: sessionCookie.split(";")[0] } })
    assert.equal(afterSignout.status, 401, "a signed-out session cookie must not authenticate")
  } finally {
    if (child && child.exitCode === null) {
      child.kill()
      await Promise.race([new Promise((resolve) => child.once("exit", resolve)), delay(3000)])
    }
    if (server?.listening) await new Promise((resolve) => server.close(resolve))
    if (mongo.topology?.isConnected()) await mongo.db(databaseName).dropDatabase()
    await mongo.close()
  }
})
