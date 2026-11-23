import assert from "node:assert/strict"
import test from "node:test"
import { grantModeratorAccess, hasModeratorAccess, isActiveModeratorGrant } from "../packages/domain/access.mjs"

test("an active grant is a named user without a revocation time", () => {
  assert.equal(isActiveModeratorGrant({ userId: "user-1", revokedAt: null }), true)
  assert.equal(isActiveModeratorGrant({ userId: "user-1", revokedAt: new Date() }), false)
  assert.equal(isActiveModeratorGrant({ userId: "  ", revokedAt: null }), false)
  assert.equal(isActiveModeratorGrant(null), false)
})

test("access is read from the current grant and can be granted again", async () => {
  const grants = new Map()
  const collection = {
    async findOne(filter) {
      const grant = grants.get(filter.userId)
      return grant && grant.revokedAt == null ? grant : null
    },
    async updateOne(filter, update) {
      const existing = grants.get(filter.userId)
      grants.set(filter.userId, {
        userId: filter.userId,
        grantedAt: existing?.grantedAt ?? update.$setOnInsert.grantedAt,
        revokedAt: update.$set.revokedAt,
        updatedAt: update.$set.updatedAt,
      })
    },
  }
  const db = { collection: () => collection }
  assert.equal(await hasModeratorAccess(db, ""), false)
  assert.equal(await hasModeratorAccess(db, "user-1"), false)
  const grantedAt = new Date("2026-11-20T00:00:00.000Z")
  await grantModeratorAccess(db, "user-1", grantedAt)
  assert.equal(await hasModeratorAccess(db, "user-1"), true)
  grants.get("user-1").revokedAt = new Date("2026-11-21T00:00:00.000Z")
  assert.equal(await hasModeratorAccess(db, "user-1"), false)
  await grantModeratorAccess(db, "user-1", new Date("2026-11-22T00:00:00.000Z"))
  assert.equal(grants.get("user-1").grantedAt.toISOString(), grantedAt.toISOString())
  assert.equal(await hasModeratorAccess(db, "user-1"), true)
})
