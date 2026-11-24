import { test } from "node:test"
import assert from "node:assert/strict"
import { ownerSubmission, retainedDemoIndexes } from "../apps/web/lib/projects/revision-submission.ts"

test("retained demo indexes cannot select arbitrary, duplicate, or out-of-range assets", () => {
  assert.deepEqual(retainedDemoIndexes([2, 0], 3), [2, 0])
  assert.equal(retainedDemoIndexes([0, 0], 3), null)
  assert.equal(retainedDemoIndexes([3], 3), null)
  assert.equal(retainedDemoIndexes([-1], 3), null)
  assert.equal(retainedDemoIndexes(["0"], 3), null)
})

test("submission lookup scopes the database query to the signed-in owner", async () => {
  let query
  const db = { collection: () => ({ findOne: async (filter) => { query = filter; return null } }) }
  await ownerSubmission(db, "507f1f77bcf86cd799439011", "owner-one")
  assert.equal(query.ownerId, "owner-one")
  assert.equal(String(query._id), "507f1f77bcf86cd799439011")
  assert.equal(await ownerSubmission(db, "not-an-id", "owner-one"), null)
})
