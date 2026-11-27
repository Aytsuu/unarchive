import { revalidateTag } from "next/cache"
import { connection } from "next/server"
import { db, mongoClient } from "@/lib/mongodb"
import { createDevelopmentOnlyHandlers, createPublishModerationHandler } from "@/lib/mcp/publish-moderation"
import { PROJECT_LIST_TAG } from "@/lib/projects/listing"

const handlers = createDevelopmentOnlyHandlers(createPublishModerationHandler({
  db,
  client: mongoClient,
  invalidateProjectList() {
    try { revalidateTag(PROJECT_LIST_TAG, { expire: 0 }) } catch { console.error("Project listing cache invalidation failed") }
  },
}))

export async function GET(request: Request) {
  await connection()
  return handlers.GET(request)
}

export async function POST(request: Request) {
  await connection()
  return handlers.POST(request)
}

export async function DELETE(request: Request) {
  await connection()
  return handlers.DELETE(request)
}
