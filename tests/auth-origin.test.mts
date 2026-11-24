import assert from "node:assert/strict"
import { test } from "node:test"
import { requestOrigin, sameOrigin } from "../lib/legal/origin.ts"

const request = (origin: string) => new Request("http://localhost:3002/signup", { headers: { origin } })

test("development accepts the loopback port the page is using", () => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = "development"
  process.env.BETTER_AUTH_URL = "http://localhost:3000"
  try {
    assert.equal(requestOrigin(request("http://localhost:3002")), "http://localhost:3002")
    assert.equal(sameOrigin(request("http://localhost:3002")), true)
    assert.equal(sameOrigin(request("https://evil.example")), false)
  } finally {
    process.env.NODE_ENV = previous
  }
})

test("production keeps the configured auth origin", () => {
  const previous = process.env.NODE_ENV
  process.env.NODE_ENV = "production"
  process.env.BETTER_AUTH_URL = "https://app.example"
  try {
    assert.equal(requestOrigin(request("http://localhost:3002")), "https://app.example")
  } finally {
    process.env.NODE_ENV = previous
  }
})
