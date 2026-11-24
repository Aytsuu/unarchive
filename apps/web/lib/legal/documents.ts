import type { Db } from "mongodb"
import { PRIVACY, TERMS } from "./policy.ts"

type StoredLegalDocument = {
  documentType: "terms" | "privacy"
  version: string
  effectiveAt: Date
  title: string
  content: typeof TERMS
  createdAt: Date
}

const indexPromises = new WeakMap<Db, Promise<void>>()

export async function ensureLegalDocuments(db: Db) {
  let pending = indexPromises.get(db)
  if (!pending) {
    const collection = db.collection<StoredLegalDocument>("legalDocuments")
    pending = collection.createIndex({ documentType: 1, version: 1 }, { unique: true }).then(async () => {
      const now = new Date()
      for (const document of [TERMS, PRIVACY]) {
        await collection.updateOne(
          { documentType: document.type, version: document.version },
          { $setOnInsert: { documentType: document.type, version: document.version, effectiveAt: new Date(`${document.effectiveAt}T00:00:00Z`), title: document.title, content: document, createdAt: now } },
          { upsert: true },
        )
      }
    }).catch((error: unknown) => {
      indexPromises.delete(db)
      throw error
    })
    indexPromises.set(db, pending)
  }
  await pending
}
