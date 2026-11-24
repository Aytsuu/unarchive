import test from "node:test"
import assert from "node:assert/strict"
import { hasAcceptedCurrentTerms, recordTermsAcceptance, recordTermsAcceptanceByEmail } from "../apps/web/lib/legal/acceptances.ts"
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "../apps/web/lib/legal/policy.ts"

function matches(row, query) {
  return Object.entries(query).every(([key, value]) => {
    if (value && typeof value === "object" && "$regex" in value) return new RegExp(value.$regex, value.$options).test(row[key])
    return row[key] === value
  })
}

function memoryDb() {
  const acceptances = []
  const users = []
  const documents = [{ documentType: "terms", version: CURRENT_TERMS_VERSION }]
  return {
    acceptances,
    users,
    collection(name) {
      const rows = name === "userPolicyAcceptances" ? acceptances : name === "user" ? users : documents
      return {
        createIndex: async () => {},
        findOne: async (query) => rows.find((row) => matches(row, query)) ?? null,
        insertOne: async (document) => {
          if (name === "userPolicyAcceptances" && acceptances.some((row) => row.userId === document.userId && row.documentType === document.documentType && row.documentVersion === document.documentVersion)) {
            const error = new Error("duplicate")
            error.code = 11000
            throw error
          }
          rows.push(document)
          return { insertedId: document._id }
        },
      }
    },
  }
}

test("terms acceptance is recorded once per user and current version", async () => {
  const db = memoryDb()
  assert.equal(await hasAcceptedCurrentTerms(db, "user-1"), false)
  const first = await recordTermsAcceptance(db, { userId: "user-1", method: "signup" })
  assert.equal(first.recorded, true)
  assert.equal(first.documentVersion, CURRENT_TERMS_VERSION)
  assert.equal(await hasAcceptedCurrentTerms(db, "user-1"), true)
  const repeat = await recordTermsAcceptance(db, { userId: "user-1", method: "sign-in" })
  assert.equal(repeat.recorded, false)
  assert.equal(await hasAcceptedCurrentTerms(db, "user-2"), false)
  assert.equal(db.acceptances.filter((row) => row.userId === "user-1" && row.documentType === "privacy" && row.documentVersion === CURRENT_PRIVACY_VERSION).length, 1)
})

test("signup records the current terms and privacy policy for a Mongo user id", async () => {
  const db = memoryDb()
  const userId = "64b7f3c2a1d4e5f678901234"
  db.users.push({ email: "Member@Example.com", _id: { toHexString: () => userId } })
  await recordTermsAcceptanceByEmail(db, "member@example.com", "signup")
  assert.deepEqual(db.acceptances.map((row) => [row.userId, row.documentType, row.documentVersion, row.method]), [
    [userId, "terms", CURRENT_TERMS_VERSION, "signup"],
    [userId, "privacy", CURRENT_PRIVACY_VERSION, "signup"],
  ])
  await recordTermsAcceptanceByEmail(db, "member@example.com", "sign-in")
  assert.equal(db.acceptances.length, 2)
})
