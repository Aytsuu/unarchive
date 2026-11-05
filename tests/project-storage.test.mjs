import assert from "node:assert/strict"
import { test } from "node:test"
import { createServer } from "node:http"
import { S3Client } from "@aws-sdk/client-s3"
import sharp from "sharp"

const { createProjectStorage, ProjectStorageValidationError } = await import(new URL("../lib/project-storage.ts", import.meta.url).href)

test("validates, sanitizes and stores demo images with generated keys", async () => {
  const commands = []
  const client = { send: async (command) => { commands.push(command); return {} } }
  const storage = createProjectStorage(client, "test-bucket")
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer()
  const keys = await storage.saveProjectDemos([new File([image], "../../unsafe.png", { type: "image/png" })])
  assert.match(keys[0], /^projects\/[0-9a-f-]+\.png$/)
  assert.equal(commands.length, 1)
  await assert.rejects(storage.saveProjectDemos([new File(["not an image"], "fake.png", { type: "image/png" })]), ProjectStorageValidationError)
  assert.equal(commands.length, 1)
})

test("cleans up uploaded objects when a later upload fails", async () => {
  const actions = []
  const client = { send: async (command) => {
    actions.push(command.constructor.name)
    if (actions.filter((name) => name === "PutObjectCommand").length === 2 && command.constructor.name === "PutObjectCommand") throw new Error("storage failure")
    return {}
  } }
  const storage = createProjectStorage(client, "test-bucket")
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "blue" } }).png().toBuffer()
  await assert.rejects(storage.saveProjectDemos([new File([image], "a.png", { type: "image/png" }), new File([image], "b.png", { type: "image/png" })]), /storage failure/)
  assert.deepEqual(actions, ["PutObjectCommand", "PutObjectCommand", "DeleteObjectCommand", "DeleteObjectCommand"])
})

test("writes, reads and deletes sanitized images through an S3-compatible endpoint", async () => {
  const objects = new Map()
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, "http://127.0.0.1").pathname
    if (req.method === "PUT") {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      objects.set(path, Buffer.concat(chunks))
      res.writeHead(200).end()
    } else if (req.method === "GET" && objects.has(path)) {
      const body = objects.get(path)
      res.writeHead(200, { "content-type": "image/png", "content-length": body.length }).end(body)
    } else if (req.method === "DELETE") {
      objects.delete(path)
      res.writeHead(204).end()
    } else res.writeHead(404).end()
  })
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve))
  const client = new S3Client({ region: "auto", endpoint: `http://127.0.0.1:${server.address().port}`, forcePathStyle: true, credentials: { accessKeyId: "test", secretAccessKey: "test" } })
  try {
    const storage = createProjectStorage(client, "test-bucket")
    const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } }).png().toBuffer()
    const [key] = await storage.saveProjectDemos([new File([image], "demo.png", { type: "image/png" })])
    const result = await storage.getProjectDemo(key)
    assert.equal(result.contentType, "image/png")
    const bytes = Buffer.from(await new Response(result.stream).arrayBuffer())
    assert.equal((await sharp(bytes).metadata()).format, "png")
    await storage.deleteProjectDemos([key])
    assert.equal(objects.size, 0)
  } finally {
    client.destroy()
    await new Promise((resolve) => server.close(resolve))
  }
})
