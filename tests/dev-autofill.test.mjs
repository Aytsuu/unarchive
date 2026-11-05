import test from "node:test"
import assert from "node:assert/strict"
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"

const moduleUrl = new URL("../lib/dev-autofill.ts", import.meta.url).href
const sampleImage = new URL("../dev-data/images/example.png", import.meta.url)

test("local development defaults and image reads are bounded to the fixture folder", async () => {
  const previousDirectory = process.cwd()
  const previousEnvironment = process.env.NODE_ENV
  const root = await mkdtemp(join(tmpdir(), "unarchive-autofill-test-"))
  try {
    await mkdir(join(root, "dev-data", "images"), { recursive: true })
    await writeFile(join(root, "dev-data", "autofill.json"), JSON.stringify({ fields: { name: "Default" }, images: ["example.png", "../secret.png"] }))
    await writeFile(join(root, "dev-data", "images", "example.png"), await readFile(sampleImage))
    process.chdir(root)
    process.env.NODE_ENV = "development"
    const { isLocalDevelopmentRequest, readAutofillConfig, readAutofillImage } = await import(moduleUrl)
    assert.equal(isLocalDevelopmentRequest(new Request("http://localhost:3000/api/dev/autofill")), true)
    assert.equal(isLocalDevelopmentRequest(new Request("http://localhost:3000/api/dev/autofill", { headers: { origin: "https://example.com" } })), false)
    assert.equal(isLocalDevelopmentRequest(new Request("http://example.com/api/dev/autofill")), false)
    assert.equal((await readAutofillConfig()).fields.name, "Default")
    assert.equal((await readAutofillConfig()).images.length, 1)
    assert.equal((await readAutofillImage("example.png")).type, "image/png")
    assert.equal(await readAutofillImage("../example.png"), null)
    await writeFile(join(root, "dev-data", "autofill.local.json"), JSON.stringify({ fields: { name: "Local" }, images: [] }))
    assert.equal((await readAutofillConfig()).fields.name, "Local")
    try {
      await symlink(join(root, "dev-data", "images", "example.png"), join(root, "dev-data", "images", "linked.png"))
      assert.equal(await readAutofillImage("linked.png"), null)
    } catch (error) {
      if (!["EPERM", "EACCES"].includes(error.code)) throw error
    }
    process.env.NODE_ENV = "production"
    assert.equal(isLocalDevelopmentRequest(new Request("http://localhost:3000/api/dev/autofill")), false)
  } finally {
    process.chdir(previousDirectory)
    if (previousEnvironment === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = previousEnvironment
    await rm(root, { recursive: true, force: true })
  }
})
