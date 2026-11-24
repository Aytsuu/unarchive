import assert from "node:assert/strict"
import { test } from "node:test"
import { matchInstitutionName } from "../apps/web/lib/institutions/match.ts"

test("matches a parsed campus name to the existing directory spelling", () => {
  assert.equal(matchInstitutionName("Cebu Technological University - Main campus", ["Cebu Technological University - Main", "Cebu Technological University - Danao"]), "Cebu Technological University - Main")
  assert.equal(matchInstitutionName(" CEBU  TECHNOLOGICAL UNIVERSITY – MAIN CAMPUS ", ["Cebu Technological University - Main"]), "Cebu Technological University - Main")
})

test("prefers an exact normalized match over a campus-suffix match", () => {
  assert.equal(matchInstitutionName("Example University - Main Campus", ["Example University - Main", "Example University - Main Campus"]), "Example University - Main Campus")
})

test("does not guess between distinct campuses or ambiguous names", () => {
  assert.equal(matchInstitutionName("Cebu Technological University", ["Cebu Technological University - Main", "Cebu Technological University - Danao"]), null)
  assert.equal(matchInstitutionName("Example University - Main CAMPUS", ["Example University - Main", "Example University — Main"]), null)
  assert.equal(matchInstitutionName("Different University", ["Example University"]), null)
  assert.equal(matchInstitutionName("", ["Example University"]), null)
})
