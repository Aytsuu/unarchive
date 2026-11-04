import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { createServer as createHttpServer } from "node:http"
import { createServer as createNetServer } from "node:net"
import { setTimeout as delay } from "node:timers/promises"
import { test } from "node:test"
import { MongoClient } from "mongodb"

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
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        RESEND_API_KEY: "re_test_mock_only",
        RESEND_BASE_URL: `http://127.0.0.1:${mockPort}`,
        EMAIL_FROM: "Test <test@example.invalid>",
        RESEND_DEBUG: "false",
      },
    })
    let ready = false
    for (let attempt = 0; attempt < 100 && !ready; attempt++) {
      if (child.exitCode !== null) throw new Error("Test Next server exited before becoming ready")
      try { ready = (await fetch(`${origin}/login`)).ok } catch { /* Wait for the local server. */ }
      if (!ready) await delay(200)
    }
    assert.ok(ready, "local Next server must start")
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
    assert.equal((await session.json()).user.email, email)
    const onboarding = await fetch(`${origin}/get-to-know`, { headers: { cookie: sessionCookie.split(";")[0] }, redirect: "manual" })
    assert.equal(onboarding.status, 200)
    const html = await onboarding.text()
    assert.match(html, /Getting to know you/)
    const afterHeading = html.slice(html.indexOf("Getting to know you"))
    const cards = afterHeading.match(/aria-hidden="true">((?:<div\b[^>]*><\/div>)+)<\/div>/)?.[1]
    assert.ok(cards, "onboarding must render the empty cards")
    assert.equal((cards.match(/<div\b/g) ?? []).length, 5, "onboarding renders five empty cards")
    assert.match(afterHeading, /<a\b[^>]*href="\/dashboard"[^>]*>Skip<\/a>/, "Skip opens the dashboard")
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
