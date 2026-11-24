import { strict as assert } from "node:assert"
import { test } from "node:test"
import { PROJECT_PROPOSAL_KEY_PATTERN } from "../apps/web/lib/project-storage-keys.mjs"

test("proposal attachment keys use the proposals prefix", () => {
  assert.match("proposals/11111111-1111-4111-a111-111111111111.png", PROJECT_PROPOSAL_KEY_PATTERN)
  assert.match("proposals/11111111-1111-4111-b111-111111111111.jpg", PROJECT_PROPOSAL_KEY_PATTERN)
  assert.doesNotMatch("projects/11111111-1111-4111-a111-111111111111.png", PROJECT_PROPOSAL_KEY_PATTERN)
  assert.doesNotMatch("proposals/not-a-uuid.png", PROJECT_PROPOSAL_KEY_PATTERN)
})
