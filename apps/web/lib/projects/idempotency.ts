import { createHash } from "node:crypto"
import { ObjectId } from "mongodb"
import type { ProjectInput } from "./validation"

export class InvalidIdempotencyKeyError extends Error {}

export async function getSubmissionIdentity(ownerId: string, key: string, project: ProjectInput, files: File[]) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(key)) {
    throw new InvalidIdempotencyKeyError("Idempotency-Key must be a UUID.")
  }
  const idHash = createHash("sha256").update(JSON.stringify([ownerId, key.toLowerCase()])).digest("hex")
  const demos = await Promise.all(files.map(async (file) => ({
    type: file.type,
    digest: createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex"),
  })))
  const digest = createHash("sha256").update(JSON.stringify({ project, demos })).digest("hex")
  return { id: ObjectId.createFromHexString(idHash.slice(0, 24)), digest }
}
