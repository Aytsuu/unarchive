import assert from "node:assert/strict"
import { createHmac, randomUUID } from "node:crypto"
import { after, before, beforeEach, test } from "node:test"
import { MongoClient } from "mongodb"
// Resolve dynamically so Node can strip the source TypeScript without requiring
// a test-only compiler or changing the application's TypeScript settings.
const { createAppAuth } = await import(new URL("../lib/auth-config.ts", import.meta.url).href)

// Run with: node --env-file=.env.local --experimental-strip-types --test tests/auth.integration.mts
// Only the randomly named database created by this test is removed in cleanup.
const mongoUri = process.env.MONGODB_URI
if (!mongoUri) throw new Error("MONGODB_URI is required for the auth integration test")
const mongo = new MongoClient(mongoUri)
const databaseName = `auth_test_${randomUUID().replaceAll("-", "")}`
const db = mongo.db(databaseName)
const codes = new Map<string, string[]>()
const origin = "http://localhost:3000"
const testSecret = "integration-test-secret-only-0123456789abcdef"
const legacyKey = createHmac("sha256", testSecret).update("legacy@example.invalid").digest("hex")
const legacyExpiration = new Date(Date.now() + 280_000)
const auth = createAppAuth({
  db,
  secret: testSecret,
  baseURL: origin,
  sendVerificationOTP: async ({ email, otp, type }: { email: string; otp: string; type: string }) => {
    if (type === "email-verification") codes.set(email, [...(codes.get(email) ?? []), otp])
  },
})

before(async () => {
  await mongo.connect()
  await db.collection<{ _id: string; expiresAt: Date }>("verificationResendCooldown").insertOne({ _id: legacyKey, expiresAt: legacyExpiration })
})
beforeEach(async () => { await db.collection("rateLimit").deleteMany({}) })
after(async () => { await db.dropDatabase(); await mongo.close() })

let address = 1
async function request(path: string, body?: Record<string, unknown>, cookie?: string, ip?: string): Promise<Response> {
  address += 1
  return auth.handler(new Request(`${origin}/api/auth${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      origin,
      "content-type": "application/json",
      "x-forwarded-for": ip ?? `198.51.100.${address}`,
      ...(cookie ? { cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  }))
}

async function expireCooldown(email: string) {
  const key = createHmac("sha256", testSecret).update(email.trim().toLowerCase()).digest("hex")
  await db.collection<{ _id: string; expiresAt: Date }>("verificationResendCooldown").updateOne(
    { _id: key }, { $set: { expiresAt: new Date(Date.now() - 1000) } },
  )
}

test("email signup, OTP verification, and session lifecycle use the real Mongo adapter", async () => {
  const email = `auth-${randomUUID()}@example.invalid`
  const password = "Only-for-this-test-7319!"
  const signup = await request("/sign-up/email", { name: "Test User", email, password })
  assert.equal(signup.status, 200, "signup should create an unverified user")
  assert.equal(signup.headers.getSetCookie().some((value) => /session_token/i.test(value)), false, "signup must not create a session")
  const firstCode = codes.get(email)?.at(-1)
  assert.ok(firstCode && /^\d{6}$/.test(firstCode), "signup should send a six-digit verification code")
  assert.equal(codes.get(email)?.length, 1, "signup should send one verification code")

  const user = await db.collection("user").findOne({ email })
  assert.ok(user, "user should be stored in MongoDB")
  assert.equal(user.emailVerified, false)
  const account = await db.collection("account").findOne({ providerId: "credential" })
  assert.ok(account?.password && account.password !== password, "password must be hashed")
  const verification = await db.collection("verification").findOne({ identifier: { $regex: email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } })
  assert.ok(verification, "verification record should be persisted")
  assert.equal(String(verification.value).includes(firstCode), false, "verification code must not be stored in plaintext")
  assert.ok(new Date(verification.expiresAt).getTime() - Date.now() <= 301_000, "verification must expire within five minutes")

  const unverifiedLogin = await request("/sign-in/email", { email, password })
  assert.notEqual(unverifiedLogin.status, 200, "unverified users must not be signed in")

  const tooSoon = await request("/email-otp/send-verification-otp", { email, type: "email-verification" })
  assert.equal(tooSoon.status, 429, "signup starts the three-minute resend cooldown")
  assert.ok(Number(tooSoon.headers.get("retry-after")) > 0 && Number(tooSoon.headers.get("retry-after")) <= 180, "cooldown supplies a Retry-After duration of at most three minutes")
  assert.equal(codes.get(email)?.length, 1)
  await expireCooldown(email)
  const resend = await request("/email-otp/send-verification-otp", { email, type: "email-verification" })
  assert.equal(resend.status, 200, "resend should be accepted")
  const newCode = codes.get(email)?.at(-1)
  assert.ok(newCode && newCode !== firstCode, "resend should rotate the verification code")
  const oldAttempt = await request("/email-otp/verify-email", { email, otp: firstCode })
  assert.notEqual(oldAttempt.status, 200, "rotated code must not verify the account")
  const verified = await request("/email-otp/verify-email", { email, otp: newCode })
  assert.equal(verified.status, 200, "current OTP should verify the email")
  const verificationCookies = verified.headers.getSetCookie()
  assert.ok(verificationCookies.some((value) => /session_token/i.test(value) && /httponly/i.test(value)), "verification must create an HTTP-only session")
  const verificationCookie = verificationCookies.map((value) => value.split(";")[0]).join("; ")
  const verifiedSession = await request("/get-session", undefined, verificationCookie)
  assert.equal((await verifiedSession.json()).user.email, email, "verified signup must establish a session")
  const reused = await request("/email-otp/verify-email", { email, otp: newCode })
  assert.notEqual(reused.status, 200, "verification code must be single-use")
  const countBeforeVerifiedSignup = codes.get(email)?.length
  await expireCooldown(email)
  const verifiedSignup = await request("/sign-up/email", { name: "Another Name", email, password: "Different-password-7319!" })
  assert.equal(verifiedSignup.status, 200)
  assert.equal(codes.get(email)?.length, countBeforeVerifiedSignup, "verified accounts should not receive signup verification OTPs")

  const wrongPassword = await request("/sign-in/email", { email, password: "Wrong-password-947!" })
  assert.notEqual(wrongPassword.status, 200)
  const login = await request("/sign-in/email", { email, password })
  assert.equal(login.status, 200, "verified users can sign in")
  const cookies = login.headers.getSetCookie()
  const sessionCookie = cookies.find((value) => /session_token/i.test(value))
  assert.ok(sessionCookie && /httponly/i.test(sessionCookie), "session cookie must be HTTP-only")
  const cookie = cookies.map((value) => value.split(";")[0]).join("; ")
  const session = await request("/get-session", undefined, cookie)
  assert.equal(session.status, 200)
  assert.equal((await session.json()).user.email, email)
  const logout = await request("/sign-out", {}, cookie)
  assert.equal(logout.status, 200)
  const afterLogout = await request("/get-session", undefined, cookie)
  assert.equal(await afterLogout.json(), null, "logout must invalidate the session")

  const disabledOtpLogin = await request("/sign-in/email-otp", { email, otp: newCode })
  assert.notEqual(disabledOtpLogin.status, 200, "OTP login endpoint must be disabled")
  for (const path of ["/email-otp/check-verification-otp", "/email-otp/request-password-reset", "/email-otp/reset-password", "/email-otp/request-email-change", "/email-otp/change-email"]) {
    const response = await request(path, { email, otp: newCode })
    assert.equal(response.status, 404, `${path} must be disabled`)
  }
})

test("simultaneous resend requests respect the server-side limit", async (context) => {
  const email = `parallel-${randomUUID()}@example.invalid`
  assert.equal((await request("/sign-up/email", { name: "Test User", email, password: "Only-for-this-test-7319!" })).status, 200)
  await expireCooldown(email)
  const requests = Array.from({ length: 4 }, () => request("/email-otp/send-verification-otp", { email, type: "email-verification" }, undefined, "198.51.100.246"))
  const responses = await Promise.all(requests)
  const indexes = await db.collection("rateLimit").indexes()
  const records = await db.collection("rateLimit").find({}).project({ key: 1, count: 1 }).toArray()
  const groups = new Map<string, number>()
  for (const record of records) groups.set(String(record.key), (groups.get(String(record.key)) ?? 0) + 1)
  context.diagnostic(`rate-limit indexes: ${JSON.stringify(indexes.map(({ name, key, unique }) => ({ name, key, unique })))}; duplicate-key groups: ${[...groups.values()].filter((count) => count > 1).join(",") || "none"}`)
  assert.equal(responses.filter((response) => response.status === 200).length, 1, "only one simultaneous resend should be allowed")
  assert.equal(responses.filter((response) => response.status === 429).length, 3)
})

test("concurrent registration cannot create duplicate identities", async () => {
  const email = `race-${randomUUID()}@example.invalid`
  const input = { name: "Test User", email, password: "Only-for-this-test-7319!" }
  await Promise.all(Array.from({ length: 3 }, () => request("/sign-up/email", input)))
  assert.equal(await db.collection("user").countDocuments({ email }), 1)
  const indexes = await db.collection("user").indexes()
  assert.ok(indexes.some((index) => index.unique && index.key.email === 1))
})

test("a resend for an unknown address cannot block its first signup", async () => {
  const email = `new-${randomUUID()}@example.invalid`
  assert.equal((await request("/email-otp/send-verification-otp", { email, type: "email-verification" })).status, 200)
  const signup = await request("/sign-up/email", { name: "Test User", email, password: "Only-for-this-test-7319!" })
  assert.equal(signup.status, 200)
  assert.equal(codes.get(email)?.length, 1, "first signup must still send its verification code")
})

test("legacy five-minute cooldowns migrate once to the three-minute interval", async () => {
  const cooldowns = db.collection<{ _id: string; expiresAt: Date; version?: number }>("verificationResendCooldown")
  assert.equal((await auth.handler(new Request(`${origin}/api/auth/get-session`))).status, 200)
  const migrated = await cooldowns.findOne({ _id: legacyKey })
  assert.ok(migrated)
  assert.equal(migrated.version, 2)
  assert.equal(migrated.expiresAt.getTime(), legacyExpiration.getTime() - 120_000)
  const anotherInstance = createAppAuth({ db, secret: testSecret, baseURL: origin, sendVerificationOTP: async () => {} })
  assert.equal((await anotherInstance.handler(new Request(`${origin}/api/auth/get-session`))).status, 200)
  const checkedAgain = await cooldowns.findOne({ _id: legacyKey })
  assert.equal(checkedAgain?.expiresAt.getTime(), migrated.expiresAt.getTime(), "a second instance must not shorten it again")

  const concurrentKey = createHmac("sha256", testSecret).update("concurrent-legacy@example.invalid").digest("hex")
  const concurrentExpiration = new Date(Date.now() + 280_000)
  await cooldowns.insertOne({ _id: concurrentKey, expiresAt: concurrentExpiration })
  const instances = Array.from({ length: 2 }, () => createAppAuth({ db, secret: testSecret, baseURL: origin, sendVerificationOTP: async () => {} }))
  const results = await Promise.all(instances.map((instance) => instance.handler(new Request(`${origin}/api/auth/get-session`))))
  assert.ok(results.every((response: Response) => response.status === 200))
  const concurrent = await cooldowns.findOne({ _id: concurrentKey })
  assert.equal(concurrent?.version, 2)
  assert.equal(concurrent?.expiresAt.getTime(), concurrentExpiration.getTime() - 120_000, "concurrent instances must migrate each record exactly once")
})

test("signup validation and persistent resend rate limit protect authentication endpoints", async () => {
  const invalid = await request("/sign-up/email", { name: "Test User", email: "invalid", password: "short" })
  assert.notEqual(invalid.status, 200, "invalid credentials must be rejected")
  const invalidKey = createHmac("sha256", testSecret).update("invalid").digest("hex")
  assert.equal(await db.collection<{ _id: string }>("verificationResendCooldown").countDocuments({ _id: invalidKey }), 0, "invalid signup must not start a cooldown")
  const email = `duplicate-${randomUUID()}@example.invalid`
  const input = { name: "Test User", email, password: "Only-for-this-test-7319!" }
  assert.equal((await request("/sign-up/email", input)).status, 200)
  const existingUser = await db.collection("user").findOne({ email })
  assert.ok(existingUser)
  const oldAccount = await db.collection("account").findOne({ providerId: "credential", userId: existingUser._id })
  assert.ok(oldAccount)
  const cooldownKey = createHmac("sha256", testSecret).update(email).digest("hex")
  const cooldowns = db.collection<{ _id: string; expiresAt: Date }>("verificationResendCooldown")
  const initialCooldown = await cooldowns.findOne({ _id: cooldownKey })
  assert.ok(initialCooldown)
  const remaining = initialCooldown.expiresAt.getTime() - Date.now()
  assert.ok(remaining > 170_000 && remaining <= 180_000, "initial signup starts a three-minute countdown")
  const duplicate = await request("/sign-up/email", { ...input, password: "Different-password-7319!" })
  assert.equal(duplicate.status, 200, "duplicate signup response should not disclose account existence")
  assert.equal(await db.collection("user").countDocuments({ email }), 1, "duplicate signup must not create another user")
  const existingAccount = await db.collection("account").findOne({ _id: oldAccount._id })
  assert.equal(existingAccount?.password, oldAccount.password, "repeated signup must not change the existing password")
  assert.equal(codes.get(email)?.length, 1, "repeated signup must respect an active cooldown")
  assert.equal((await cooldowns.findOne({ _id: cooldownKey }))?.expiresAt.getTime(), initialCooldown.expiresAt.getTime(), "repeated signup must not extend an active cooldown")
  await expireCooldown(email)
  await db.collection("rateLimit").deleteMany({})
  const retry = await request("/sign-up/email", input)
  assert.equal(retry.status, 200)
  assert.equal(codes.get(email)?.length, 2, "repeated signup after the cooldown should issue a fresh OTP")

  const body = { email, type: "email-verification" }
  await db.collection("rateLimit").deleteMany({})
  await expireCooldown(email)
  const first = await request("/email-otp/send-verification-otp", body, undefined, "198.51.100.245")
  const otherEmail = await request("/email-otp/send-verification-otp", { email: `other-${randomUUID()}@example.invalid`, type: "email-verification" })
  const second = await request("/email-otp/send-verification-otp", body, undefined, "198.51.100.245")
  assert.equal(first.status, 200)
  assert.equal(otherEmail.status, 200, "another email must not inherit the first recipient's cooldown")
  assert.equal(second.status, 429, "resend must enforce its server-side cooldown")
  assert.ok(await db.collection("rateLimit").countDocuments() > 0, "rate limits must be persisted")

  const forbiddenOrigin = await auth.handler(new Request(`${origin}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { origin: "https://untrusted.invalid", "content-type": "application/json" },
    body: JSON.stringify({ email, password: input.password }),
  }))
  assert.equal(forbiddenOrigin.status, 403, "cross-origin authentication requests must be rejected")
})

test("verification rejects expired codes and limits incorrect attempts", async () => {
  const email = `expiry-${randomUUID()}@example.invalid`
  const signup = await request("/sign-up/email", { name: "Test User", email, password: "Only-for-this-test-7319!" })
  assert.equal(signup.status, 200)
  const otp = codes.get(email)?.at(-1)
  assert.ok(otp)
  const wrongCode = otp === "000000" ? "000001" : "000000"
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await request("/email-otp/verify-email", { email, otp: wrongCode })
    assert.notEqual(result.status, 200, "incorrect OTP must be rejected")
    await db.collection("rateLimit").deleteMany({})
  }
  const locked = await request("/email-otp/verify-email", { email, otp })
  assert.notEqual(locked.status, 200, "correct OTP must be rejected after three incorrect attempts")

  const expiredEmail = `expired-${randomUUID()}@example.invalid`
  const otherSignup = await request("/sign-up/email", { name: "Test User", email: expiredEmail, password: "Only-for-this-test-7319!" })
  assert.equal(otherSignup.status, 200)
  const expiredOtp = codes.get(expiredEmail)?.at(-1)
  assert.ok(expiredOtp)
  const result = await db.collection("verification").updateOne(
    { identifier: { $regex: expiredEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") } },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
  )
  assert.equal(result.matchedCount, 1)
  const expired = await request("/email-otp/verify-email", { email: expiredEmail, otp: expiredOtp })
  assert.notEqual(expired.status, 200, "expired OTP must be rejected")
})

test("OTP requests cannot reveal account existence or trigger unsupported mail types", async () => {
  const email = `known-${randomUUID()}@example.invalid`
  const unknown = `unknown-${randomUUID()}@example.invalid`
  assert.equal((await request("/sign-up/email", { name: "Test User", email, password: "Only-for-this-test-7319!" })).status, 200)
  await expireCooldown(email)
  const knownVerification = await request("/email-otp/send-verification-otp", { email, type: "email-verification" })
  await db.collection("rateLimit").deleteMany({})
  const unknownVerification = await request("/email-otp/send-verification-otp", { email: unknown, type: "email-verification" })
  assert.equal(knownVerification.status, unknownVerification.status, "verification resend must not reveal whether an email is registered")
  assert.deepEqual(await knownVerification.json(), await unknownVerification.json())
  const knownAgain = await request("/email-otp/send-verification-otp", { email, type: "email-verification" })
  const unknownAgain = await request("/email-otp/send-verification-otp", { email: unknown, type: "email-verification" })
  assert.equal(knownAgain.status, 429)
  assert.equal(unknownAgain.status, 429, "cooldown response must not disclose whether an email exists")
  for (const type of ["sign-in", "forget-password"]) {
    await db.collection("rateLimit").deleteMany({})
    const known = await request("/email-otp/send-verification-otp", { email, type })
    await db.collection("rateLimit").deleteMany({})
    const missing = await request("/email-otp/send-verification-otp", { email: unknown, type })
    assert.equal(known.status, missing.status, `${type} must not reveal whether an email is registered`)
    assert.deepEqual(await known.json(), await missing.json())
    assert.ok(known.status >= 400 && known.status < 500, `unsupported ${type} must be rejected`)
  }
})

test("Google links only verified matching identities to the existing user", async () => {
  const email = `google-${randomUUID()}@example.invalid`
  const input = { name: "Test User", email, password: "Only-for-this-test-7319!" }
  assert.equal((await request("/sign-up/email", input)).status, 200)
  const user = await db.collection("user").findOne({ email })
  assert.ok(user)
  let providerVerified = true
  const googleAuth = createAppAuth({
    db,
    secret: "integration-test-secret-only-0123456789abcdef",
    baseURL: origin,
    sendVerificationOTP: async () => {},
    google: {
      clientId: "test-client",
      clientSecret: "test-secret",
      verifyIdToken: async () => true,
      getUserInfo: async () => ({
        user: { email, name: "Google User", emailVerified: providerVerified },
        data: { sub: "google-test-subject", email, email_verified: providerVerified },
      }),
    },
  })
  const googleSignIn = () => googleAuth.handler(new Request(`${origin}/api/auth/sign-in/social`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ provider: "google", idToken: { token: "test-token" } }),
  }))

  assert.notEqual((await googleSignIn()).status, 200, "unverified local account must not be linked")
  const otp = codes.get(email)?.at(-1)
  assert.ok(otp)
  assert.equal((await request("/email-otp/verify-email", { email, otp })).status, 200)
  providerVerified = false
  assert.notEqual((await googleSignIn()).status, 200, "unverified Google email must not be linked")
  await db.collection("rateLimit").deleteMany({})
  providerVerified = true
  assert.equal((await googleSignIn()).status, 200)
  const linked = await db.collection("account").findOne({ providerId: "google", accountId: "google-test-subject" })
  assert.ok(linked)
  assert.equal(String(linked.userId), String(user._id), "Google identity must retain the existing user")
  assert.equal(await db.collection("user").countDocuments({ email }), 1)
  assert.equal((await googleSignIn()).status, 200, "linked Google identity can sign in again")
})

test("Google sign-in cannot create a new account, including explicit signup requests", async () => {
  const email = `new-google-${randomUUID()}@example.invalid`
  const googleId = `google-${randomUUID()}`
  const googleAuth = createAppAuth({
    db,
    secret: testSecret,
    baseURL: origin,
    sendVerificationOTP: async () => {},
    google: {
      clientId: "test-client",
      clientSecret: "test-secret",
      verifyIdToken: async () => true,
      getUserInfo: async () => ({
        user: { email, name: "Google User", emailVerified: true },
        data: { sub: googleId, email, email_verified: true },
      }),
    },
  })
  for (const requestSignUp of [false, true]) {
    const response = await googleAuth.handler(new Request(`${origin}/api/auth/sign-in/social`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({ provider: "google", idToken: { token: "test-token" }, requestSignUp }),
    }))
    assert.notEqual(response.status, 200)
    assert.equal(response.headers.getSetCookie().some((value: string) => /session_token/i.test(value)), false)
    assert.equal(await db.collection("user").countDocuments({ email }), 0)
    assert.equal(await db.collection("account").countDocuments({ providerId: "google", accountId: googleId }), 0)
  }
})
