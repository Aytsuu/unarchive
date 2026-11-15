import assert from "node:assert/strict"
import { test } from "node:test"

const { formatSavedLabel } = await import(new URL("../lib/projects/saved.ts", import.meta.url).href)

test("formats saved project labels for recent saves", () => {
  const now = new Date(2026, 2, 11, 15, 0, 0)
  assert.equal(formatSavedLabel(new Date(2026, 2, 11, 8, 0, 0), now), "Saved today")
  assert.equal(formatSavedLabel(new Date(2026, 2, 10, 20, 0, 0), now), "Saved yesterday")
  assert.equal(formatSavedLabel(new Date(2026, 8, 21, 20, 0, 0), now), "Saved on Sep 21")
  assert.equal(formatSavedLabel(new Date(2025, 5, 21, 20, 0, 0), now), "06/21/2025")
})