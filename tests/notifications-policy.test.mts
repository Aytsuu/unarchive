import assert from "node:assert/strict"
import { test } from "node:test"
import { addedReferenceIds, belongsToReferenceGroup, defaultEmailPreferences, notificationExpiry, referenceEventId, referenceGroupKey, starEventId, starGroupKey } from "../apps/web/lib/notifications/policy.ts"

test("reference diffs keep only newly added valid ids", () => {
  assert.deepEqual(addedReferenceIds(["65c000000000000000000001", "not-an-id"], ["65C000000000000000000001", "65c000000000000000000002"]), ["65c000000000000000000002"])
})

test("reference event ids are stable for a published version", () => {
  assert.equal(referenceEventId("65C00000000000000000000A", 2, "65c00000000000000000000B"), "project.referenced:65c00000000000000000000a:2:65c00000000000000000000b")
})

test("references within 24 hours belong to the same group", () => {
  const first = new Date("2026-11-20T08:00:00.000Z")
  assert.equal(belongsToReferenceGroup(first, new Date("2026-11-21T08:00:00.000Z")), true)
  assert.equal(belongsToReferenceGroup(first, new Date("2026-11-21T08:00:00.001Z")), false)
})

test("in-app notifications expire 90 days after the activity", () => {
  assert.equal(notificationExpiry(new Date("2026-11-20T00:00:00.000Z")).toISOString(), "2027-02-18T00:00:00.000Z")
})

test("star event ids stay stable for one committed star and group apart from references", () => {
  const occurredAt = new Date("2026-11-24T09:30:00.000Z")
  assert.equal(starEventId("65C00000000000000000000A", "user-a", occurredAt), "project.starred:65c00000000000000000000a:user-a:2026-11-24T09:30:00.000Z")
  assert.notEqual(starGroupKey("owner", "65c00000000000000000000a"), referenceGroupKey("owner", "65c00000000000000000000a"))
})

test("optional notification email stays off until the user enables it", () => {
  assert.deepEqual(defaultEmailPreferences, { projectReferences: false, projectStars: false, productAnnouncements: false, whatsNew: false })
})
