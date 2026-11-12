import { cacheLife, cacheTag } from "next/cache"
import { connection } from "next/server"
import { db } from "@/lib/mongodb"
import { PROJECT_LIST_TAG } from "@/lib/projects/listing"
import { getProjectStatistics } from "@/lib/projects/statistics"

async function getCachedStatistics() {
  "use cache"
  cacheLife({ stale: 30, revalidate: 60, expire: 300 })
  cacheTag(PROJECT_LIST_TAG)
  return getProjectStatistics(db)
}

export async function GET() {
  await connection()
  try {
    const statistics = await getCachedStatistics()
    return Response.json({ success: true, data: statistics }, { headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    console.error("Project statistics failed", error)
    return Response.json({ success: false, error: "Unable to load project statistics." }, { status: 500, headers: { "Cache-Control": "no-store" } })
  }
}
