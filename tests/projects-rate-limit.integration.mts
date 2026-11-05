import { randomUUID } from "node:crypto"
import { test } from "node:test"
import assert from "node:assert/strict"
import { MongoClient } from "mongodb"

const { claimProjectAttempt } = await import(new URL("../lib/projects/rate-limit.ts", import.meta.url).href)

test("publish rate limit is per user and atomic under concurrent attempts", async () => {
  const client = new MongoClient(process.env.MONGODB_URI!, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const databaseName = `project_limit_test_${randomUUID().replaceAll("-", "")}`
  try {
    await client.connect()
    const db = client.db(databaseName)
    const attempts = await Promise.all(Array.from({ length: 12 }, () => claimProjectAttempt(db, "user-a")))
    assert.equal(attempts.filter((value) => value === 0).length, 10)
    assert.equal(attempts.filter((value) => value > 0).length, 2)
    assert.equal(await claimProjectAttempt(db, "user-b"), 0)
    await db.collection<{ _id: string; expiresAt: Date }>("projectPublishRateLimit").updateOne({ _id: "user-a" }, { $set: { expiresAt: new Date(0) } })
    assert.equal(await claimProjectAttempt(db, "user-a"), 0)
  } finally {
    await client.db(databaseName).dropDatabase()
    await client.close()
  }
})
