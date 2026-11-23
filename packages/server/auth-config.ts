import { betterAuth } from "better-auth"
import { mongodbAdapter } from "@better-auth/mongo-adapter"
import { APIError, createAuthMiddleware } from "better-auth/api"
import { emailOTP } from "better-auth/plugins"
import { createHmac } from "node:crypto"
import path from "node:path"
import type { Db, MongoClient } from "mongodb"

const RESEND_INTERVAL_MS = 3 * 60 * 1000

function workspaceRootName(): string {
  let dir = process.cwd()
  const base = path.basename(dir)
  if ((base === "web" || base === "moderator") && path.basename(path.dirname(dir)) === "apps") {
    dir = path.dirname(path.dirname(dir))
  }
  return path.basename(dir)
}

function devCookiePrefix(): string | undefined {
  if (process.env.NODE_ENV === "production") return undefined
  const name = workspaceRootName().toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "")
  return name ? `ba-${name}` : "ba-dev"
}

type AuthOptions = {
  db: Db
  mongoClient?: MongoClient
  useTransactions?: boolean
  secret: string
  baseURL: string
  google?: { clientId: string; clientSecret: string }
  sendVerificationOTP: (message: { email: string; otp: string; type: "email-verification" }) => Promise<void>
  onAuthenticatedEmail?: (db: Db, email: string, source: "signup" | "sign-in") => Promise<void>
}

/** Shared configuration also permits integration tests to provide an isolated database and mail transport. */
export function createAppAuth(options: AuthOptions) {
  const cooldowns = options.db.collection<{ _id: string; expiresAt: Date; version?: number }>("verificationResendCooldown")
  const cooldownKey = (email: string) => createHmac("sha256", options.secret).update(email.trim().toLowerCase()).digest("hex")

  async function claimResend(email: string): Promise<number> {
    const now = new Date()
    const expiresAt = new Date(now.getTime() + RESEND_INTERVAL_MS)
    const key = cooldownKey(email)
    try {
      await cooldowns.insertOne({ _id: key, expiresAt, version: 2 })
      return 0
    } catch (error) {
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error
    }
    const result = await cooldowns.updateOne({ _id: key, expiresAt: { $lte: now } }, { $set: { expiresAt, version: 2 } })
    if (result.modifiedCount === 1) return 0
    const existing = await cooldowns.findOne({ _id: key })
    return existing ? Math.max(1, Math.ceil((existing.expiresAt.getTime() - Date.now()) / 1000)) : claimResend(email)
  }

  let indexSetup: Promise<void> | undefined
  function ensureIndexes() {
    if (!indexSetup) {
      indexSetup = Promise.all([
        options.db.collection("user").createIndex({ email: 1 }, { unique: true }),
        options.db.collection("session").createIndex({ token: 1 }, { unique: true }),
        options.db.collection("rateLimit").createIndex({ key: 1 }, { unique: true }),
        options.db.collection("verification").createIndex({ identifier: 1 }, { unique: true }),
        options.db.collection("account").createIndex({ providerId: 1, accountId: 1 }, { unique: true }),
        cooldowns.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
      ]).then(async () => {
        // Old records used five minutes; marking each update atomically keeps
        // the conversion idempotent across concurrent application instances.
        await cooldowns.updateMany(
          { version: { $exists: false } },
          [{ $set: { expiresAt: { $subtract: ["$expiresAt", 120_000] }, version: 2 } }],
        )
      }).catch((error: unknown) => {
        indexSetup = undefined
        throw error
      })
    }
    return indexSetup
  }

  const auth = betterAuth({
    secret: options.secret,
    baseURL: options.baseURL,
    ...(process.env.NODE_ENV === "production" ? {} : { trustedOrigins: ["http://localhost:*", "http://127.0.0.1:*", "http://[::1]:*"] }),
    // Provider and database errors may contain addresses, tokens or codes.
    logger: {
      level: "warn",
      log(level) {
        if (level === "error") console.error("Authentication operation failed")
        else if (level === "warn") console.warn("Authentication operation warning")
      },
    },
    database: mongodbAdapter(options.db, options.useTransactions ? { client: options.mongoClient, transaction: true } : { transaction: false }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      autoSignIn: false,
      minPasswordLength: 8,
      async onExistingUserSignUp({ user }) {
        if (user.emailVerified) return
        // Use the HTTP handler so repeated signup attempts share the same
        // persistent resend limit as the public verification endpoint.
        const endpoint = new URL("/api/auth/email-otp/send-verification-otp", options.baseURL)
        try {
          await auth.handler(new Request(endpoint, {
            method: "POST",
            headers: { "content-type": "application/json", origin: new URL(options.baseURL).origin },
            body: JSON.stringify({ email: user.email, type: "email-verification" }),
          }))
        } catch {
          console.error("Verification email request failed")
        }
      },
    },
    emailVerification: { sendOnSignUp: true, autoSignInAfterVerification: true },
    socialProviders: options.google ? { google: { ...options.google, disableSignUp: true } } : {},
    account: { accountLinking: { enabled: true, disableImplicitLinking: false, requireLocalEmailVerified: true } },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    // The local server has no trusted proxy to authenticate forwarded headers.
    advanced: { ipAddress: { ipAddressHeaders: [] }, ...(devCookiePrefix() ? { cookiePrefix: devCookiePrefix() } : {}) },
    rateLimit: {
      enabled: true,
      storage: "database",
      customRules: { "/email-otp/send-verification-otp": { window: 60, max: 30 } },
    },
    disabledPaths: [
      "/sign-in/email-otp",
      "/email-otp/check-verification-otp",
      "/email-otp/request-password-reset",
      "/forget-password/email-otp",
      "/email-otp/reset-password",
      "/email-otp/request-email-change",
      "/email-otp/change-email",
    ],
    hooks: {
      before: createAuthMiddleware(async (context) => {
        if (context.path === "/email-otp/send-verification-otp") {
          if (context.body?.type !== "email-verification") {
            throw new APIError("BAD_REQUEST", { message: "Unsupported verification method" })
          }
        }
        const isResend = context.path === "/email-otp/send-verification-otp"
        const body = context.body
        if (isResend && typeof body?.email === "string" && body.email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) {
          const retryAfter = await claimResend(body.email)
          if (retryAfter > 0) throw new APIError("TOO_MANY_REQUESTS", { message: "Please wait before requesting another code" }, { "Retry-After": String(retryAfter) })
        }
      }),
      after: createAuthMiddleware(async (context) => {
        const result = context.context.returned
        const succeeded = result instanceof Response ? result.ok : !!result && typeof result === "object" && "user" in result
        const recordsPolicyAcceptance = context.path === "/sign-up/email" || context.path === "/sign-in/email" || context.path === "/email-otp/verify-email"
        if (recordsPolicyAcceptance && succeeded && typeof context.body?.email === "string" && context.body.email.length <= 254) {
          if (context.path === "/sign-up/email") await claimResend(context.body.email)
          try {
            await options.onAuthenticatedEmail?.(options.db, context.body.email, context.path === "/sign-up/email" ? "signup" : "sign-in")
          } catch {
            console.error("Could not record terms acceptance")
          }
        }
      }),
    },
    plugins: [
      emailOTP({
        overrideDefaultEmailVerification: true,
        sendVerificationOnSignUp: true,
        disableSignUp: true,
        otpLength: 6,
        expiresIn: 300,
        allowedAttempts: 3,
        storeOTP: "hashed",
        resendStrategy: "rotate",
        async sendVerificationOTP({ email, otp, type }) {
          if (type !== "email-verification") {
            throw new Error("This email verification method is not available")
          }
          await options.sendVerificationOTP({ email, otp, type })
        },
      }),
    ],
  })

  return {
    ...auth,
    async handler(request: Request) {
      try {
        await ensureIndexes()
      } catch {
        console.error("Authentication database initialization failed")
        return Response.json({ error: "Authentication is temporarily unavailable" }, { status: 503 })
      }
      return auth.handler(request)
    },
  }
}
