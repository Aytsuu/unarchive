import test from "node:test"
import assert from "node:assert/strict"
import { hasAcceptedCurrentTerms, recordTermsAcceptance } from "../lib/legal/acceptances.ts"
import { CURRENT_TERMS_VERSION } from "../lib/legal/policy.ts"

function memoryDb() {
  const acceptances = []
  const documents = [{ documentType: "terms", version: CURRENT_TERMS_VERSION }]
  return {
    collection(name) {
      const rows = name === "userPolicyAcceptances" ? acceptances : documents
      return {
        createIndex: async () => {},
        findOne: async (query) => rows.find((row) => Object.entries(query).every(([key, value]) => row[key] === value)) ?? null,
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
})
