import { ObjectId, type Db } from "mongodb"

export async function ownerSubmission(db: Db, id: string, ownerId: string) {
  if (!/^[a-f\d]{24}$/i.test(id)) return null
  return db.collection("projectSubmissions").findOne({ _id: new ObjectId(id), ownerId }, { maxTimeMS: 3000 })
}

export function retainedDemoIndexes(value: unknown, count: number): number[] | null {
  if (!Array.isArray(value) || value.some((index) => !Number.isInteger(index) || index < 0 || index >= count)) return null
  if (new Set(value).size !== value.length) return null
  return [...value]
}
