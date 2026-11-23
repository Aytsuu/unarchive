import "server-only"
import { createAppAuth } from "@unarchive/server/auth-config"
import { db, mongoClient } from "@unarchive/server/mongodb"

const secret = process.env.BETTER_AUTH_SECRET
const baseURL = process.env.BETTER_AUTH_URL

if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters")
if (!baseURL) throw new Error("BETTER_AUTH_URL is not configured")

export const auth = createAppAuth({
  db,
  mongoClient,
  useTransactions: process.env.MONGO_ENABLE_TRANSACTIONS === "true",
  secret,
  baseURL,
  async sendVerificationOTP() {},
})
