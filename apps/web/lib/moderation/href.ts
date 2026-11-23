import "server-only"
import { hasModeratorAccess } from "@unarchive/domain/access"
import { moderatorAppUrl } from "@unarchive/domain/return-url"
import { db } from "@/lib/mongodb"

export async function moderationHrefFor(userId: string | undefined) {
  if (!userId || !(await hasModeratorAccess(db, userId))) return undefined
  return moderatorAppUrl() || undefined
}
