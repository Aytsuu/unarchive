import assert from "node:assert/strict"
import { test } from "node:test"
const { prepareProjectEdit } = await import(new URL("../lib/projects/edit-draft.ts", import.meta.url).href)

test("project edits trim values without dropping ordered authors, references, or topic assignments", () => {
  const draft = { title: "  Final title  ", description: " Summary ", abstract: " Abstract ", institution: " Campus ", dateStarted: "2023-04", dateEnded: "2024-05", topics: ["AI & Data Science"], links: [{ value: " https://example.org " }, { value: " " }], contributors: [{ value: " Rivera, A. " }, { value: " Santos, B. " }], references: [{ id: "abcdef0123456789abcdef01" }] }
  assert.deepEqual(prepareProjectEdit(draft), { title: "Final title", description: "Summary", abstract: "Abstract", institution: "Campus", projectType: "thesis", dateStarted: "2023-04", dateEnded: "2024-05", topics: ["AI & Data Science"], links: ["https://example.org"], contributors: ["Rivera, A.", "Santos, B."], referenceProjectIds: ["abcdef0123456789abcdef01"] })
})

test("empty editable fields remain explicit and no image keys or consents are sent", () => {
  const draft = { title: "A", description: "", abstract: "", institution: "", dateStarted: "", dateEnded: "", topics: [], links: [], contributors: [], references: [] }
  const payload = prepareProjectEdit(draft)
  assert.deepEqual(payload.referenceProjectIds, [])
  assert.equal("demos" in payload, false)
  assert.equal("consents" in payload, false)
})
