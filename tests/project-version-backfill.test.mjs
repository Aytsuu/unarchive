import assert from "node:assert/strict"
import { test } from "node:test"
import { ObjectId } from "mongodb"
import { backfillProjectVersions } from "../scripts/backfill-project-versions.mjs"

test("backfill processes projects through the atomic baseline writer and reports repeats", async () => {
  const ids = [new ObjectId(), new ObjectId(), new ObjectId()]
  let receivedFilter
  const db = { collection: () => ({ find: (filter) => { receivedFilter = filter; return { async *[Symbol.asyncIterator]() { for (const _id of ids) yield { _id } } } } }) }
  const results = []
  const capture = async (_client, _db, id) => ({ version: 1, created: id.equals(ids[0]) })
  const counts = await backfillProjectVersions({}, db, capture, (result) => results.push(result))
  assert.deepEqual(receivedFilter, { withdrawnAt: { $exists: false } })
  assert.deepEqual(counts, { created: 1, existing: 2 })
  assert.equal(results.length, 3)
})

test("backfill stops and reports errors instead of silently skipping records", async () => {
  const db = { collection: () => ({ find: () => ({ async *[Symbol.asyncIterator]() { yield { _id: new ObjectId() } } }) }) }
  await assert.rejects(backfillProjectVersions({}, db, async () => { throw new Error("baseline failed") }), /baseline failed/)
})
