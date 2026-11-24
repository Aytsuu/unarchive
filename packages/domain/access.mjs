export const GRANTS_COLLECTION = "moderatorGrants"

export function isActiveModeratorGrant(grant) {
  return Boolean(grant && typeof grant.userId === "string" && grant.userId.trim() && grant.revokedAt == null)
}

export async function hasModeratorAccess(db, userId) {
  if (typeof userId !== "string" || !userId.trim()) return false
  const grant = await db.collection(GRANTS_COLLECTION).findOne(
    { userId, revokedAt: null },
    { projection: { userId: 1, revokedAt: 1 }, maxTimeMS: 3000 },
  )
  return isActiveModeratorGrant(grant)
}

export async function grantModeratorAccess(db, userId, now = new Date()) {
  if (typeof userId !== "string" || !userId.trim()) throw new Error("A user id is required.")
  const grantedAt = now
  await db.collection(GRANTS_COLLECTION).updateOne(
    { userId },
    { $set: { userId, revokedAt: null, updatedAt: grantedAt }, $setOnInsert: { grantedAt } },
    { upsert: true },
  )
}
