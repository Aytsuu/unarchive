import test from "node:test"
import assert from "node:assert/strict"
import { deleteAuthRecords, validateLocalTarget } from "../scripts/reset-auth.mjs"

test("only accepts a named local MongoDB target", () => {
  assert.doesNotThrow(() => validateLocalTarget("mongodb://user:pass@127.0.0.1:27017/?authSource=admin", "unarchive"))
  for (const uri of ["mongodb://example.com:27017", "mongodb+srv://localhost", "mongodb://localhost,example.com", "invalid"]) {
    assert.throws(() => validateLocalTarget(uri, "unarchive"))
  }
  for (const name of ["", "admin", "local", "config", "bad/name"]) {
    assert.throws(() => validateLocalTarget("mongodb://localhost:27017", name))
  }
})

test("deletes auth collections and leaves other collections untouched", async () => {
  const records = Object.fromEntries(["user", "account", "session", "verification", "verificationResendCooldown", "rateLimit", "projectSaves", "other"].map(name => [name, [1, 2]]))
  const db = { collection: name => ({ deleteMany: async query => {
    assert.deepEqual(query, {})
    const deletedCount = records[name].length
    records[name] = []
    return { deletedCount }
  } }) }
  const result = await deleteAuthRecords(db)
  assert.equal(result.length, 7)
  assert.ok(result.every(item => item.deletedCount === 2))
  assert.deepEqual(records.other, [1, 2])
})

test("reports deletion failures instead of claiming success", async () => {
  const db = { collection: () => ({ deleteMany: async () => { throw new Error("database error") } }) }
  await assert.rejects(deleteAuthRecords(db), /database error/)
})
