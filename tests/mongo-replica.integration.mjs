import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { randomUUID } from "node:crypto"
import { createServer } from "node:net"
import { resolve } from "node:path"
import { setTimeout as delay } from "node:timers/promises"
import { test } from "node:test"
import { MongoClient } from "mongodb"

function docker(...args) {
  return execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], windowsHide: true }).trim()
}

async function reservePort() {
  const server = createServer()
  await new Promise((accept, reject) => server.once("error", reject).listen(0, "127.0.0.1", accept))
  const port = server.address().port
  await new Promise((accept, reject) => server.close((error) => error ? reject(error) : accept()))
  return port
}

async function connect(port) {
  for (let attempt = 0; attempt < 60; attempt++) {
    const client = new MongoClient(`mongodb://test-user:test-password@127.0.0.1:${port}/?authSource=admin&directConnection=true`, { serverSelectionTimeoutMS: 500 })
    try { await client.connect(); return client } catch { await client.close(); await delay(500) }
  }
  throw new Error("Timed out waiting for test MongoDB")
}

test("authenticated standalone data survives replica conversion and supports transactions", { timeout: 120_000 }, async () => {
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12)
  const container = `unarchive-replica-test-${suffix}`
  const volume = `unarchive-replica-test-${suffix}`
  const port = await reservePort()
  const common = ["--detach", "--rm", "--name", container, "--publish", `127.0.0.1:${port}:27017`, "--env", "MONGO_INITDB_ROOT_USERNAME=test-user", "--env", "MONGO_INITDB_ROOT_PASSWORD=test-password", "--mount", `type=volume,source=${volume},target=/data/db`]
  let client
  try {
    docker("volume", "create", volume)
    docker("run", ...common, "mongo:8.0")
    client = await connect(port)
    await client.db("replica_test").collection("sentinel").insertOne({ preserved: true })
    await client.close(); client = undefined
    docker("stop", container)
    docker("run", ...common, "--mount", `type=bind,source=${resolve("scripts/mongo-entrypoint.sh")},target=/tmp/unarchive-entrypoint.sh,readonly`, "--mount", `type=bind,source=${resolve("scripts/mongo-init-replica.js")},target=/tmp/unarchive-init.js,readonly`, "--entrypoint", "bash", "mongo:8.0", "/tmp/unarchive-entrypoint.sh")
    client = await connect(port)
    await client.close(); client = undefined
    docker("exec", container, "mongosh", "--quiet", "--host", "127.0.0.1", "--file", "/tmp/unarchive-init.js")
    docker("exec", container, "mongosh", "--quiet", "--host", "127.0.0.1", "--file", "/tmp/unarchive-init.js")
    client = await connect(port)
    const db = client.db("replica_test")
    assert.ok(await db.collection("sentinel").findOne({ preserved: true }))
    await client.withSession((session) => session.withTransaction(async () => {
      await db.collection("one").insertOne({ value: 1 }, { session })
      await db.collection("two").insertOne({ value: 2 }, { session })
    }))
    assert.equal(await db.collection("one").countDocuments(), 1)
    assert.equal(await db.collection("two").countDocuments(), 1)
  } finally {
    if (client) await client.close()
    try { docker("stop", container) } catch {}
    try { docker("volume", "rm", volume) } catch {}
  }
})
