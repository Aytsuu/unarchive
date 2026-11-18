import assert from "node:assert/strict"
import { test } from "node:test"
const { ARCHIVED_SNAPSHOT_HEADING, archivedSnapshotDescription } = await import(new URL("../lib/projects/archived-snapshot.ts", import.meta.url).href)

test("describes a preserved snapshot date without inventing one", () => {
  assert.equal(ARCHIVED_SNAPSHOT_HEADING, "You're viewing an archived snapshot")
  assert.equal(archivedSnapshotDescription(new Date("2025-03-12T08:30:00Z")), "This is a preserved version of the project as published on March 12, 2025. Its content may differ from the latest version.")
  assert.equal(archivedSnapshotDescription(new Date("not-a-date")), null)
})
