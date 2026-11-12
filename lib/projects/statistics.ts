import type { Db, Document } from "mongodb"

export type InstitutionStatistic = { name: string; count: number }
export type TopicStatistic = { name: string; count: number }
export type PublisherStatistic = { id: string; name: string; count: number }
export type ProjectStatistics = {
  totalProjects: number
  institutions: InstitutionStatistic[]
  topics: TopicStatistic[]
  publishers: { monthly: PublisherStatistic[]; annually: PublisherStatistic[] }
}

type OwnerCount = { _id: string; count: number }

function publisherPipeline(start: Date, end: Date): Document[] {
  return [
    { $match: { createdAt: { $gte: start, $lt: end }, ownerId: { $type: "string", $ne: "" } } },
    { $group: { _id: "$ownerId", count: { $sum: 1 } } },
    { $sort: { count: -1, _id: 1 } },
  ]
}

/** Aggregate only public project statistics; the reporting periods use UTC calendar boundaries. */
export async function getProjectStatistics(db: Db, now = new Date()): Promise<ProjectStatistics> {
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const [result] = await db.collection("projects").aggregate<{
    totals: { count: number }[]
    institutions: InstitutionStatistic[]
    topics: TopicStatistic[]
    monthly: OwnerCount[]
    annually: OwnerCount[]
  }>([
    { $facet: {
      totals: [{ $count: "count" }],
      institutions: [
        { $match: { institution: { $type: "string" } } },
        { $project: { name: { $trim: { input: "$institution" } } } },
        { $match: { name: { $ne: "" } } },
        { $group: { _id: { $toLower: "$name" }, name: { $first: "$name" }, count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $project: { _id: 0, name: 1, count: 1 } },
      ],
      topics: [
        { $project: { topics: { $cond: [{ $isArray: "$topics" }, { $setUnion: ["$topics", []] }, []] } } },
        { $unwind: "$topics" },
        { $match: { topics: { $type: "string", $ne: "" } } },
        { $group: { _id: "$topics", count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $project: { _id: 0, name: "$_id", count: 1 } },
      ],
      monthly: publisherPipeline(new Date(Date.UTC(year, month, 1)), new Date(Date.UTC(year, month + 1, 1))),
      annually: publisherPipeline(new Date(Date.UTC(year, 0, 1)), new Date(Date.UTC(year + 1, 0, 1))),
    } },
  ], { maxTimeMS: 3000 }).toArray()
  const monthly = result?.monthly ?? []
  const annually = result?.annually ?? []
  const ownerIds = [...new Set([...monthly, ...annually].map((owner) => owner._id))]
  const users = ownerIds.length ? await db.collection("user").aggregate<{ _id: unknown; name?: string }>([
    { $match: { $expr: { $in: [{ $toString: "$_id" }, ownerIds] } } },
    { $project: { name: 1 } },
  ], { maxTimeMS: 3000 }).toArray() : []
  const names = new Map(users.map((user) => [String(user._id), user.name]))
  const withNames = (owners: OwnerCount[]) => owners.map((owner) => ({ id: owner._id, name: names.get(owner._id) || "Publisher", count: owner.count }))
  return {
    totalProjects: result?.totals[0]?.count ?? 0,
    institutions: result?.institutions ?? [],
    topics: result?.topics ?? [],
    publishers: { monthly: withNames(monthly), annually: withNames(annually) },
  }
}
