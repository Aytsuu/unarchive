import { strict as assert } from "node:assert"
import { test } from "node:test"
import { bubbleDiameter, institutionShare } from "../lib/projects/institution-bubbles.mjs"

test("bubble sizes grow with the number of projects and stay within bounds", () => {
  assert.equal(bubbleDiameter(1, 1), 104)
  assert.ok(bubbleDiameter(1, 100) < bubbleDiameter(25, 100))
  assert.equal(bubbleDiameter(100, 100), 104)
  assert.equal(bubbleDiameter(0, 0), 44)
  assert.ok(bubbleDiameter(10, 10, 20) < bubbleDiameter(10, 10, 1))
  assert.ok(bubbleDiameter(1, 10, 20) < bubbleDiameter(10, 10, 20))
})

test("institution share uses the total of projects with a named institution", () => {
  assert.equal(institutionShare(2, 8), 25)
  assert.equal(institutionShare(0, 0), 0)
  assert.equal(institutionShare(1, 3), 33)
})
