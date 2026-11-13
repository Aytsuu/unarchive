import { test } from "node:test"
import assert from "node:assert/strict"
const { parseProject } = await import(new URL("../lib/projects/validation.ts", import.meta.url).href)

const valid = { title: " Test ", description: " Description ", institution: " University ", links: [" https://example.com/path ", ""], contributors: [" Ada ", " "], consents: { permission: true, contributorsPermission: true, detailsAccurate: true, universityIp: true } }

test("normalizes project fields and ignores empty optional entries", () => {
  assert.deepEqual(parseProject(valid), { projectType: "thesis", title: "Test", description: "Description", institution: "University", links: ["https://example.com/path"], contributors: ["Ada"], consents: { permission: true, contributorsPermission: true, detailsAccurate: true, universityIp: true } })
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

test("validates and deduplicates optional project topics", () => {
  assert.equal(parseProject(valid).topics, undefined)
  assert.equal(parseProject({ ...valid, topics: [] }).topics, undefined)
  assert.deepEqual(parseProject({ ...valid, topics: ["AI & Data Science", "Health & Medicine", "AI & Data Science"] }).topics, ["AI & Data Science", "Health & Medicine"])
  for (const topics of [null, "AI & Data Science", ["unknown"], [null], Array(9).fill("AI & Data Science")]) {
    assert.throws(() => parseProject({ ...valid, topics }))
  }
})

test("validates and normalizes optional referenced project IDs", () => {
  const first = "abcdef0123456789abcdef01"
  const second = "0123456789abcdef01234567"
  assert.equal(parseProject(valid).referenceProjectIds, undefined)
  assert.equal(parseProject({ ...valid, referenceProjectIds: [] }).referenceProjectIds, undefined)
  assert.deepEqual(parseProject({ ...valid, referenceProjectIds: [first.toUpperCase(), second, first] }).referenceProjectIds, [first, second])
  for (const references of [null, first, [null], [""], ["invalid"], ["a".repeat(25)], Array(21).fill(first)]) {
    assert.throws(() => parseProject({ ...valid, referenceProjectIds: references }))
  }
})

test("requires explicit confirmation that project details are accurate", () => {
  for (const detailsAccurate of [undefined, false, "true", 1, null]) {
    assert.throws(() => parseProject({ ...valid, consents: { ...valid.consents, detailsAccurate } }))
  }
  assert.equal(parseProject({ ...valid, consents: { ...valid.consents, detailsAccurate: true, universityIp: true } }).consents.detailsAccurate, true)
})

test("requires explicit confirmation to respect university intellectual property", () => {
  for (const universityIp of [undefined, false, "true", 1, null]) {
    assert.throws(() => parseProject({ ...valid, consents: { ...valid.consents, universityIp } }))
  }
  assert.equal(parseProject(valid).consents.universityIp, true)
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


test("academic completion is sourced from the end date, never a separate submitted year", () => {
  assert.equal(parseProject(valid).projectType, "thesis")
  const ended = parseProject({ ...valid, dateEnded: "2024-05", completionYear: "2022" })
  assert.equal(ended.dateEnded, "2024-05")
  assert.equal("completionYear" in ended, false)
  const missing = parseProject({ ...valid, completionYear: "2024" })
  assert.equal(missing.dateEnded, undefined)
  assert.equal("completionYear" in missing, false)
  for (const projectType of [null, "", "dissertation", 42]) assert.throws(() => parseProject({ ...valid, projectType }))
})
