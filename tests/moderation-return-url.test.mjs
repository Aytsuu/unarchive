import assert from "node:assert/strict"
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { loginRedirectForModerator, moderatorAppUrl, safeModeratorReturn } from "../packages/domain/return-url.mjs"
import { readTestAccount } from "../packages/domain/test-account.mjs"

test("return destinations stay on the moderator origin", () => {
  const origin = "http://localhost:3100"
  assert.equal(safeModeratorReturn("http://localhost:3100/reviews/abc?status=pending", origin), "http://localhost:3100/reviews/abc?status=pending")
  assert.equal(safeModeratorReturn("http://localhost:3100", origin), "http://localhost:3100/")
  assert.equal(safeModeratorReturn("https://evil.example/login", origin), null)
  assert.equal(safeModeratorReturn("http://localhost:3000/home", origin), null)
  assert.equal(safeModeratorReturn("http://user:pass@localhost:3100/", origin), null)
  assert.equal(safeModeratorReturn("not a url", origin), null)
})

test("login sends guests to the web app and back to the moderator queue", () => {
  assert.equal(
    loginRedirectForModerator("http://localhost:3000", "http://localhost:3104"),
    "http://localhost:3000/login?next=http%3A%2F%2Flocalhost%3A3104%2F",
  )
  assert.throws(() => loginRedirectForModerator("http://localhost:3000", "javascript:alert(1)"), /not valid/)
})

test("the moderator origin follows the running stack port", async () => {
  const root = await mkdtemp(join(tmpdir(), "moderation-ports-"))
  try {
    assert.equal(moderatorAppUrl({ NODE_ENV: "development" }, root), "http://localhost:3100")
    await mkdir(join(root, ".stack"))
    await writeFile(join(root, ".stack", "ports.json"), JSON.stringify({ web: 3002, moderator: 3104 }))
    assert.equal(moderatorAppUrl({ NODE_ENV: "development" }, root), "http://localhost:3104")
    assert.equal(moderatorAppUrl({ NODE_ENV: "development", MODERATOR_APP_URL: "https://moderator.unarchive.com" }, root), "https://moderator.unarchive.com")
    assert.equal(moderatorAppUrl({ NODE_ENV: "production" }, root), "")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test("test credentials are read from the local env file", () => {
  assert.deepEqual(readTestAccount("username = moderator@example.com\npassword = secret-value\n"), {
    username: "moderator@example.com",
    password: "secret-value",
  })
  assert.throws(() => readTestAccount("BETTER_AUTH_URL=http://localhost:3000\n"), /username and password/)
})
