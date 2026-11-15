import type { ClientSession, Db } from "mongodb"
import { ObjectId } from "mongodb"
import { CURRENT_TERMS_VERSION, PUBLISH_CONFIRMATION_TEXT, PUBLISH_CONFIRMATION_TEXT_VERSION } from "./policy.ts"

export type PublicationConfirmationRecord = {
  projectId: ObjectId
  userId: string
  rightsPermissionConfirmed: true
  informationAndContributorsConfirmed: true
  termsVersion: string
  confirmationTextVersion: string
  confirmationText: { rights: string; accuracy: string }
  confirmedAt: Date
}

const indexPromises = new WeakMap<Db, Promise<void>>()

export async function ensurePublicationConfirmationIndexes(db: Db) {
  let pending = indexPromises.get(db)
  if (!pending) {
    const collection = db.collection<PublicationConfirmationRecord>("projectPublicationConfirmations")
    pending = Promise.all([
      collection.createIndex({ projectId: 1 }, { unique: true }),
      collection.createIndex({ userId: 1, confirmedAt: -1 }),
    ]).then(() => undefined).catch((error: unknown) => {
      indexPromises.delete(db)
      throw error
    })
    indexPromises.set(db, pending)
  }
  await pending
}

export function publicationConfirmationDocument(projectId: ObjectId, userId: string, confirmedAt = new Date()): PublicationConfirmationRecord {
  return {
    projectId,
    userId,
    rightsPermissionConfirmed: true,
    informationAndContributorsConfirmed: true,
    termsVersion: CURRENT_TERMS_VERSION,
    confirmationTextVersion: PUBLISH_CONFIRMATION_TEXT_VERSION,
    confirmationText: { rights: PUBLISH_CONFIRMATION_TEXT.rights, accuracy: PUBLISH_CONFIRMATION_TEXT.accuracy },
    confirmedAt,
  }
}

export async function recordPublicationConfirmation(db: Db, projectId: ObjectId, userId: string, session?: ClientSession) {
  await ensurePublicationConfirmationIndexes(db)
  const document = publicationConfirmationDocument(projectId, userId)
  try {
    await db.collection<PublicationConfirmationRecord>("projectPublicationConfirmations").insertOne(document, session ? { session } : {})
    return { recorded: true }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) return { recorded: false }
    throw error
  }
}
