import type { Db } from "mongodb"
import { CURRENT_TERMS_VERSION } from "./policy.ts"

export type TermsAcceptanceMethod = "signup" | "sign-in" | "publish" | "explicit"
export type TermsAcceptanceRecord = {
  userId: string
  documentType: "terms"
  documentVersion: string
  acceptedAt: Date
  method: TermsAcceptanceMethod
}

const indexPromises = new WeakMap<Db, Promise<void>>()

async function ensureIndexes(db: Db) {
  let pending = indexPromises.get(db)
  if (!pending) {
    const collection = db.collection<TermsAcceptanceRecord>("userPolicyAcceptances")
    pending = collection.createIndex({ userId: 1, documentType: 1, documentVersion: 1 }, { unique: true }).then(() => undefined).catch((error: unknown) => {
      indexPromises.delete(db)
      throw error
    })
    indexPromises.set(db, pending)
  }
  await pending
}

export async function hasAcceptedCurrentTerms(db: Db, userId: string) {
  if (!userId) return false
  await ensureIndexes(db)
  const existing = await db.collection<TermsAcceptanceRecord>("userPolicyAcceptances").findOne({
    userId,
    documentType: "terms",
    documentVersion: CURRENT_TERMS_VERSION,
  })
  return Boolean(existing)
}

export async function recordTermsAcceptance(db: Db, input: { userId: string; method: TermsAcceptanceMethod }) {
  await ensureIndexes(db)
  const document: TermsAcceptanceRecord = {
    userId: input.userId,
    documentType: "terms",
    documentVersion: CURRENT_TERMS_VERSION,
    acceptedAt: new Date(),
    method: input.method,
  }
  try {
    await db.collection<TermsAcceptanceRecord>("userPolicyAcceptances").insertOne(document)
    return { recorded: true, documentVersion: CURRENT_TERMS_VERSION }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      return { recorded: false, documentVersion: CURRENT_TERMS_VERSION }
    }
    throw error
  }
}

export async function recordTermsAcceptanceByEmail(db: Db, email: string, method: TermsAcceptanceMethod) {
  const normalized = email.trim()
  if (!normalized) return
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const user = await db.collection<{ id?: string; _id?: string; email?: string }>("user").findOne(
    { email: { $regex: `^${escaped}$`, $options: "i" } },
    { projection: { id: 1, _id: 1 } },
  )
  const userId = user?.id ?? (typeof user?._id === "string" ? user._id : "")
  if (!userId) return
  await recordTermsAcceptance(db, { userId, method })
}
