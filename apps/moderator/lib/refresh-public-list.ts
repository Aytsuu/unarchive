import "server-only"
import { headers } from "next/headers"

export async function refreshPublicList() {
  const webOrigin = process.env.WEB_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000"
  const cookie = (await headers()).get("cookie") ?? ""
  try {
    const response = await fetch(new URL("/api/projects/listing/revalidate", webOrigin), {
      method: "POST",
      headers: { cookie, origin: webOrigin },
      cache: "no-store",
    })
    if (!response.ok) console.error("Public project list could not be refreshed")
  } catch {
    console.error("Public project list could not be refreshed")
  }
}
