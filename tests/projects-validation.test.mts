import { test } from "node:test"
import assert from "node:assert/strict"
const { parseProject } = await import(new URL("../lib/projects/validation.ts", import.meta.url).href)

const valid = { title: " Test ", description: " Description ", institution: " University ", links: [" https://example.com/path ", ""], contributors: [" Ada ", " "], consents: { permission: true, contributorsPermission: true } }

test("normalizes project fields and ignores empty optional entries", () => {
  assert.deepEqual(parseProject(valid), { title: "Test", description: "Description", institution: "University", links: ["https://example.com/path"], contributors: ["Ada"], consents: { permission: true, contributorsPermission: true } })
})

test("accepts an optional abstract and enforces its length and type", () => {
  assert.equal(parseProject({ ...valid, abstract: "  A concise abstract.  " }).abstract, "A concise abstract.")
  assert.equal(parseProject({ ...valid, abstract: " " }).abstract, undefined)
  assert.equal(parseProject(valid).abstract, undefined)
  assert.equal(parseProject({ ...valid, abstract: "a".repeat(10000) }).abstract?.length, 10000)
  assert.throws(() => parseProject({ ...valid, abstract: "a".repeat(10001) }))
  assert.throws(() => parseProject({ ...valid, abstract: 5 }))
})

test("validates optional month and year project dates and chronological order", () => {
  assert.equal(parseProject({ ...valid, dateStarted: "2023-02", dateEnded: "2024-11" }).dateStarted, "2023-02")
  assert.equal(parseProject({ ...valid, dateStarted: "2023-02", dateEnded: "2024-11" }).dateEnded, "2024-11")
  assert.equal(parseProject({ ...valid, dateStarted: "2023-02", dateEnded: "2023-02" }).dateEnded, "2023-02")
  assert.equal(parseProject({ ...valid, dateStarted: "", dateEnded: "" }).dateStarted, undefined)
  for (const date of ["2023-00", "2023-13", "2023-2", "0000-01", "2023-02-01", 42, null]) {
    assert.throws(() => parseProject({ ...valid, dateStarted: date }))
    assert.throws(() => parseProject({ ...valid, dateEnded: date }))
  }
  assert.throws(() => parseProject({ ...valid, dateStarted: "2023-03", dateEnded: "2023-02" }))
})

test("rejects missing title, unsafe URLs, unconfirmed consents, and excessive values", () => {
  for (const data of [
    { ...valid, title: "  " },
    { ...valid, title: "a".repeat(201) },
    { ...valid, links: ["javascript:alert(1)"] },
    { ...valid, links: ["https://user:password@example.com"] },
    { ...valid, links: Array(21).fill("https://example.com") },
    { ...valid, contributors: Array(51).fill("Ada") },
    { ...valid, consents: { permission: false, contributorsPermission: true } },
    { ...valid, consents: null },
    null,
  ]) assert.throws(() => parseProject(data))
})
