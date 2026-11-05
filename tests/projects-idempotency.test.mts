import { test } from "node:test"
import assert from "node:assert/strict"
const { getSubmissionIdentity } = await import(new URL("../lib/projects/idempotency.ts", import.meta.url).href)

const project = { title: "Project", description: "", institution: "", links: [], contributors: [], consents: { permission: true, contributorsPermission: true } }
const key = "66f68d76-f6d3-4108-b26d-a9e0fc02997a"

test("keys are scoped per owner and matching inputs have matching fingerprints", async () => {
  const first = await getSubmissionIdentity("user-a", key, project, [new File(["abc"], "x.png", { type: "image/png" })])
  const replay = await getSubmissionIdentity("user-a", key.toUpperCase(), project, [new File(["abc"], "other.png", { type: "image/png" })])
  const other = await getSubmissionIdentity("user-b", key, project, [new File(["abc"], "x.png", { type: "image/png" })])
  const changed = await getSubmissionIdentity("user-a", key, project, [new File(["different"], "x.png", { type: "image/png" })])
  const changedAbstract = await getSubmissionIdentity("user-a", key, { ...project, abstract: "New abstract" }, [new File(["abc"], "x.png", { type: "image/png" })])
  assert.equal(first.id.toString(), replay.id.toString())
  assert.equal(first.digest, replay.digest)
  assert.notEqual(first.id.toString(), other.id.toString())
  assert.notEqual(first.digest, changed.digest)
  assert.notEqual(first.digest, changedAbstract.digest)
})

test("malformed idempotency keys are rejected", async () => {
  await assert.rejects(getSubmissionIdentity("user", "invalid", project, []))
})
