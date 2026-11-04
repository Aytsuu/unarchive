import "server-only"
import { after } from "next/server"
import { createAppAuth } from "./auth-config"
import { sendEmail } from "./email"
import { db, mongoClient } from "./mongodb"

const secret = process.env.BETTER_AUTH_SECRET
const baseURL = process.env.BETTER_AUTH_URL
const clientId = process.env.GOOGLE_CLIENT_ID
const clientSecret = process.env.GOOGLE_CLIENT_SECRET

if (!secret || secret.length < 32) throw new Error("BETTER_AUTH_SECRET must contain at least 32 characters")
if (!baseURL) throw new Error("BETTER_AUTH_URL is not configured")
if (Boolean(clientId) !== Boolean(clientSecret)) throw new Error("Both Google OAuth credentials must be configured")

export const auth = createAppAuth({
  db,
  mongoClient,
  useTransactions: process.env.MONGO_ENABLE_TRANSACTIONS === "true",
  secret,
  baseURL,
  google: clientId && clientSecret ? { clientId, clientSecret } : undefined,
  async sendVerificationOTP({ email, otp }) {
    // Scheduling delivery after the response prevents provider latency and
    // failures from disclosing whether the submitted email has an account.
    after(async () => {
      try {
        await sendEmail({
          to: email,
          subject: "Verify your email",
          text: `Your verification code is ${otp}. It expires in 5 minutes.`,
        })
      } catch {
        // Do not log recipients, codes, or provider errors containing them.
        console.error("Verification email delivery failed")
      }
    })
  },
})
