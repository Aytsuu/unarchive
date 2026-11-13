import assert from "node:assert/strict"
import { test } from "node:test"
const { createCitation, isLocalDevelopmentUrl } = await import(new URL("../lib/projects/citation.ts", import.meta.url).href)

const complete = { abstract: "A summary of the work.", publishedAt: "2026-11-13T10:20:30.000Z", title: "Campus resource hub", authors: ["Rivera, A.", "Santos, S."], completionYear: "2024", institution: "Example University", projectType: "Thesis", url: "https://unarchive.example/projects/123" }

test("formats complete citation components while preserving author order and spelling", () => {
  assert.deepEqual(createCitation(complete), {
    ok: true,
    beforeTitle: "Rivera, A., & Santos, S. (2024). ",
    title: "Campus resource hub",
    afterTitle: " [Thesis, Example University]. Unarchive. https://unarchive.example/projects/123",
    text: "Rivera, A., & Santos, S. (2024). Campus resource hub [Thesis, Example University]. Unarchive. https://unarchive.example/projects/123",
  })
})

test("preserves free-text authors without assuming given or family name", () => {
  const result = createCitation({ ...complete, authors: ["Maria de la Cruz"] })
  assert.equal(result.ok, true)
  assert.ok(result.text.startsWith("Maria de la Cruz (2024). "))
})

test("lists first nineteen and the last of twenty-one or more authors", () => {
  const authors = Array.from({ length: 21 }, (_, index) => `Author ${index + 1}`)
  const result = createCitation({ ...complete, authors })
  assert.equal(result.ok, true)
  assert.ok(result.beforeTitle.includes("Author 19, … Author 21"))
  assert.equal(result.beforeTitle.includes("Author 20"), false)
})

test("refuses missing or invalid citation metadata without inventing values", () => {
  const result = createCitation({ ...complete, authors: [], title: "", institution: "", completionYear: "", projectType: "", url: "https://user:pass@example.com/path" })
  assert.deepEqual(result, { ok: false, missing: ["title", "authors", "completion year", "institution"] })
  assert.equal(createCitation({ ...complete, completionYear: "2024-05" }).ok, false)
  const unsafeUrl = createCitation({ ...complete, url: "javascript:alert(1)" })
  assert.equal(unsafeUrl.ok, true)
  assert.ok(!unsafeUrl.text.includes("javascript:"))
})

test("citation does not require an abstract, publication date, project type or URL", () => {
  const result = createCitation({ ...complete, abstract: "", publishedAt: "", projectType: "", url: "" })
  assert.equal(result.ok, true)
  assert.equal(result.text, "Rivera, A., & Santos, S. (2024). Campus resource hub. Example University. Unarchive.")
  assert.ok(!result.text.includes("Thesis"), "do not invent a thesis description for an unconfirmed project")
})

test("identifies local development URLs without mislabeling hosted URLs", () => {
  for (const url of ["http://localhost:3000/projects/123", "http://127.0.0.1:3000/projects/123", "http://[::1]:3000/projects/123"]) assert.equal(isLocalDevelopmentUrl(url), true)
  assert.equal(isLocalDevelopmentUrl("https://unarchive.example/projects/123"), false)
})

test("citation identifies the specific saved version", () => {
  const result = createCitation({ ...complete, version: 2 })
  assert.equal(result.ok, true)
  assert.ok(result.text.includes("Campus resource hub (Version 2) [Thesis"))
  const invalid = createCitation({ ...complete, version: 0 })
  assert.equal(invalid.ok, true)
  assert.ok(!invalid.text.includes("Version 0"))
})
