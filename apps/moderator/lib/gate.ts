import "server-only"
import { headers } from "next/headers"
import { forbidden, redirect } from "next/navigation"
import { hasModeratorAccess } from "@unarchive/domain/access"
import { loginRedirectForModerator } from "@unarchive/domain/return-url"
import { auth } from "./auth"
import { db } from "@unarchive/server/mongodb"

export async function requireModerator() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) {
    const webOrigin = process.env.WEB_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000"
    const moderatorOrigin = process.env.MODERATOR_APP_URL || "http://localhost:3100"
    redirect(loginRedirectForModerator(webOrigin, moderatorOrigin))
  }
  if (!(await hasModeratorAccess(db, session.user.id))) forbidden()
  return session.user
}
