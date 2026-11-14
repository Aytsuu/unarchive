import { test } from "node:test"
import assert from "node:assert/strict"

const { parseProposalMessage, ProposalValidationError } = await import(new URL("../lib/projects/proposal-validation.ts", import.meta.url).href)

test("trims and requires a proposal message up to 10,000 characters", () => {
  assert.equal(parseProposalMessage("  Hello collaborators.  "), "Hello collaborators.")
  assert.equal(parseProposalMessage("a".repeat(10000)).length, 10000)
  for (const value of ["", "   ", "a".repeat(10001), 12, null, undefined]) {
    assert.throws(() => parseProposalMessage(value), ProposalValidationError)
  }
})
