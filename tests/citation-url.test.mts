import assert from "node:assert/strict"
import { test } from "node:test"
const { canonicalProjectUrl } = await import(new URL("../lib/projects/citation-url.ts", import.meta.url).href)

test("uses the configured origin and validates the project identifier", () => {
  assert.equal(canonicalProjectUrl("https://unarchive.example/auth", "abcdef0123456789abcdef01"), "https://unarchive.example/projects/abcdef0123456789abcdef01")
  assert.equal(canonicalProjectUrl("http://localhost:3000", "ABCDEF0123456789ABCDEF01"), "http://localhost:3000/projects/abcdef0123456789abcdef01")
  for (const invalid of ["", "javascript:alert(1)", "https://user:pass@example.com", "not-a-url"]) assert.equal(canonicalProjectUrl(invalid, "abcdef0123456789abcdef01"), "")
  assert.equal(canonicalProjectUrl("https://unarchive.example", "../bad"), "")
})

test("canonical version URLs identify a valid immutable version", () => {
  assert.equal(canonicalProjectUrl("https://unarchive.example", "abcdef0123456789abcdef01", 2), "https://unarchive.example/projects/abcdef0123456789abcdef01/versions/2")
  for (const version of [0, -1, 1.5, NaN, Number.MAX_SAFE_INTEGER + 1]) assert.equal(canonicalProjectUrl("https://unarchive.example", "abcdef0123456789abcdef01", version), "")
})
