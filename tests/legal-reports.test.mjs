import test from "node:test"
import assert from "node:assert/strict"
import { parseContentReport, REPORT_CATEGORIES } from "../lib/legal/reports.ts"
import { isLegalAdmin } from "../lib/legal/admin.ts"

test("content reports require a known category and bounded details", () => {
  assert.deepEqual(REPORT_CATEGORIES, ["copyright", "authorship", "contributor", "confidential", "privacy", "policy"])
  const parsed = parseContentReport({
    category: "copyright",
    details: "  This project copies our manuscript.  ",
    projectId: "ABCDEF0123456789ABCDEF01",
    contactEmail: "reporter@example.com",
  })
  assert.deepEqual(parsed, {
    category: "copyright",
    details: "This project copies our manuscript.",
    projectId: "abcdef0123456789abcdef01",
    contactEmail: "reporter@example.com",
  })
  for (const value of [
    null,
    {},
    { category: "unknown", details: "Hello" },
    { category: "privacy", details: "" },
    { category: "privacy", details: "a".repeat(5001) },
    { category: "policy", details: "Hello", projectId: "invalid" },
    { category: "policy", details: "Hello", contactEmail: "not-an-email" },
  ]) {
    assert.throws(() => parseContentReport(value))
  }
})

test("legal admin access is limited to configured emails", () => {
  assert.equal(isLegalAdmin("owner@example.com", ""), false)
  assert.equal(isLegalAdmin("owner@example.com", "admin@example.com"), false)
  assert.equal(isLegalAdmin("Admin@Example.com", "admin@example.com, other@example.com"), true)
  assert.equal(isLegalAdmin("", "admin@example.com"), false)
})
