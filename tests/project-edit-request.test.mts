import assert from "node:assert/strict"
import { test } from "node:test"
const { parseEditPayload, parseEditKey } = await import(new URL("../lib/projects/version-edit.mjs", import.meta.url).href)
const { parseProject } = await import(new URL("../lib/projects/validation.ts", import.meta.url).href)
const input = { title: " Rewritten title ", projectType: "thesis", institution: "University", contributors: ["Santos, A."], links: [], topics: [], referenceProjectIds: [] }

test("edit validation normalizes metadata while discarding caller-provided consents", () => {
  const result = parseEditPayload({ expectedVersion: 2, project: { ...input, ownerId: "attacker", consents: { permission: false } } }, parseProject)
  assert.equal(result.expectedVersion, 2)
  assert.equal(result.project.title, "Rewritten title")
  assert.equal("ownerId" in result.project, false)
  assert.equal(result.project.consents.permission, true)
})

test("edit version and metadata are strictly validated", () => {
  for (const expectedVersion of [0, -1, 1.5, "1", null, Number.MAX_SAFE_INTEGER + 1]) assert.throws(() => parseEditPayload({ expectedVersion, project: input }, parseProject))
  assert.throws(() => parseEditPayload({ expectedVersion: 1, project: null }, parseProject))
  assert.throws(() => parseEditPayload({ expectedVersion: 1, project: { ...input, title: "" } }, parseProject))
})

test("edit idempotency keys must be UUIDs and are normalized", () => {
  assert.equal(parseEditKey("66F68D76-F6D3-4108-B26D-A9E0FC02997A"), "66f68d76-f6d3-4108-b26d-a9e0fc02997a")
  for (const key of [null, "", "not-a-uuid"]) assert.throws(() => parseEditKey(key))
})
