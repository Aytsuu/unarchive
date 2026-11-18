import { ObjectId, type Db } from "mongodb"

export type RelatedProjectCard = { id: string; title: string; description: string; href: string }

type RelatedRecord = { _id: { toHexString(): string } | string; title?: string; description?: string; withdrawnAt?: Date }

function recordId(value: RelatedRecord["_id"]) {
  return (typeof value === "string" ? value : value.toHexString()).toLowerCase()
}

export function relatedProjectCards(ids: string[], records: RelatedRecord[]): RelatedProjectCard[] {
  const byId = new Map<string, RelatedProjectCard>()
  for (const record of records) {
    if (record.withdrawnAt) continue
    const title = typeof record.title === "string" ? record.title.trim() : ""
    if (!title) continue
    const id = recordId(record._id)
    if (!/^[a-f\d]{24}$/.test(id)) continue
    const description = typeof record.description === "string" ? record.description.trim() : ""
    byId.set(id, { id, title, description, href: `/projects/${id}` })
  }
  const seen = new Set<string>()
  return ids.flatMap((value) => {
    if (!/^[a-f\d]{24}$/i.test(value)) return []
    const id = value.toLowerCase()
    if (seen.has(id)) return []
    seen.add(id)
    const card = byId.get(id)
    return card ? [card] : []
  })
}

export function relatedProjectIds(snapshot: { references?: { id: string }[]; referenceProjectIds?: string[] }) {
  if (snapshot.references?.length) return snapshot.references.map((item) => item.id)
  return snapshot.referenceProjectIds ?? []
}

export function citedByMatch(projectId: string) {
  if (!/^[a-f\d]{24}$/i.test(projectId)) return null
  return { referenceProjectIds: projectId.toLowerCase(), withdrawnAt: { $exists: false } as const }
}

const projection = { title: 1, description: 1 } as const

export async function loadRelatedProjectCards(db: Db, ids: string[]) {
  const validIds = ids.filter((id) => /^[a-f\d]{24}$/i.test(id))
  if (!validIds.length) return []
  const records = await db.collection("projects").find({ _id: { $in: validIds.map((id) => new ObjectId(id)) }, withdrawnAt: { $exists: false } }, { projection, maxTimeMS: 3000 }).toArray()
  return relatedProjectCards(validIds, records)
}

export async function loadCitedByProjectCards(db: Db, projectId: string) {
  const match = citedByMatch(projectId)
  if (!match) return []
  const records = await db.collection("projects").find({ ...match, _id: { $ne: new ObjectId(match.referenceProjectIds) } }, { projection, maxTimeMS: 3000 }).sort({ createdAt: -1, _id: -1 }).limit(50).toArray()
  return relatedProjectCards(records.map((record) => record._id.toHexString()), records)
}
