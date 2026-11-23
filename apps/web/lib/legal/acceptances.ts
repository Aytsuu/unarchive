import type { Db } from "mongodb"
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "./policy.ts"

export type TermsAcceptanceMethod = "signup" | "sign-in" | "publish" | "explicit"
export type PolicyDocumentType = "terms" | "privacy"
export type TermsAcceptanceRecord = {
  userId: string
  documentType: PolicyDocumentType
  documentVersion: string
  acceptedAt: Date
  method: TermsAcceptanceMethod
}

const currentPolicyVersions: Record<PolicyDocumentType, string> = {
  terms: CURRENT_TERMS_VERSION,
  privacy: CURRENT_PRIVACY_VERSION,
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

function acceptanceUserId(user: { id?: unknown; _id?: unknown } | null) {
  if (!user) return ""
  if (typeof user.id === "string" && user.id.trim()) return user.id.trim()
  const raw = user._id
  if (typeof raw === "string" && raw.trim()) return raw.trim()
  if (raw && typeof raw === "object" && "toHexString" in raw && typeof raw.toHexString === "function") {
    const text = raw.toHexString()
    if (typeof text === "string" && text.trim()) return text.trim()
  }
  return ""
}

async function insertAcceptance(db: Db, document: TermsAcceptanceRecord) {
  try {
    await db.collection<TermsAcceptanceRecord>("userPolicyAcceptances").insertOne(document)
    return true
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) return false
    throw error
  }
}

export async function recordCurrentPolicyAcceptances(db: Db, input: { userId: string; method: TermsAcceptanceMethod }) {
  if (!input.userId) return { terms: false, privacy: false }
  await ensureIndexes(db)
  const acceptedAt = new Date()
  const recorded = { terms: false, privacy: false }
  for (const documentType of ["terms", "privacy"] as const) {
    recorded[documentType] = await insertAcceptance(db, {
      userId: input.userId,
      documentType,
      documentVersion: currentPolicyVersions[documentType],
      acceptedAt,
      method: input.method,
    })
  }
  return recorded
}

export async function recordTermsAcceptance(db: Db, input: { userId: string; method: TermsAcceptanceMethod }) {
  const recorded = await recordCurrentPolicyAcceptances(db, input)
  return { recorded: recorded.terms, documentVersion: CURRENT_TERMS_VERSION }
}

export async function recordTermsAcceptanceByEmail(db: Db, email: string, method: TermsAcceptanceMethod) {
  const normalized = email.trim()
  if (!normalized) return
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const user = await db.collection<{ id?: string; _id?: unknown; email?: string }>("user").findOne(
    { email: { $regex: `^${escaped}$`, $options: "i" } },
    { projection: { id: 1, _id: 1 } },
  )
  const userId = acceptanceUserId(user)
  if (!userId) return
  await recordCurrentPolicyAcceptances(db, { userId, method })
}
