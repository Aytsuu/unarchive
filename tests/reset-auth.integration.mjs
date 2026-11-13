import test from "node:test"
import assert from "node:assert/strict"
import { randomUUID } from "node:crypto"
import { spawnSync } from "node:child_process"
import { MongoClient } from "mongodb"
import { validateLocalTarget } from "../scripts/reset-auth.mjs"

test("reset requires confirmation and removes only authentication records", async () => {
  const database = `reset_test_${randomUUID().replaceAll("-", "")}`
  const uri = process.env.MONGODB_URI
  validateLocalTarget(uri, database)
  const client = new MongoClient(uri, { directConnection: true, serverSelectionTimeoutMS: 5000 })
  const names = ["session", "account", "verification", "verificationResendCooldown", "rateLimit", "projectSaves", "user"]
  try {
    await client.connect()
    const db = client.db(database)
    for (const name of [...names, "unrelated"]) await db.collection(name).insertOne({ marker: true })
    const run = input => spawnSync(process.execPath, ["scripts/reset-auth.mjs"], {
      env: { ...process.env, MONGODB_DB_NAME: database }, input, encoding: "utf8",
    })
    const cancelled = run("no\n")
    assert.equal(cancelled.status, 0, cancelled.stderr)
    assert.match(cancelled.stdout, /Cancelled/)
    assert.equal(await db.collection("user").countDocuments(), 1)
    const confirmed = run(`${database}\n`)
    assert.equal(confirmed.status, 0, confirmed.stderr)
    assert.match(confirmed.stdout, /reset complete/)
    for (const name of names) assert.equal(await db.collection(name).countDocuments(), 0)
    assert.equal(await db.collection("unrelated").countDocuments(), 1)
  } finally {
    await client.db(database).dropDatabase()
    await client.close()
  }
})
