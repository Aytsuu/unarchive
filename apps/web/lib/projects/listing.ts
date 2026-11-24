import "server-only"
import { ObjectId } from "mongodb"
import { cacheLife, cacheTag } from "next/cache"
import { db } from "@/lib/mongodb"
import { listingMatch, listingSortNeedsMetrics, listingSortSpec } from "@/lib/projects/listing-params.mjs"

export const PROJECT_LIST_TAG = "projects-list"
type ProjectRecord = { _id: ObjectId; title: string; description?: string; institution?: string; ownerId: string; topics?: string[]; contributors?: string[]; createdAt: Date; dateEnded?: string; withdrawnAt?: Date }
export type ListingFilters = { search: string; topic?: string; sort?: string; yearFrom?: number | null; yearTo?: number | null; institutions?: string[] }

async function hydrateListing(records: ProjectRecord[], total: number, requestedPage: number, pageSize: number) {
  const page = Math.min(Math.max(1, requestedPage), Math.max(1, Math.ceil(total / pageSize) || 1))
  const ownerIds = [...new Set(records.map((project) => project.ownerId).filter(Boolean))]
  const owners = ownerIds.length ? await db.collection("user").aggregate<{ _id: ObjectId | string; name?: string }>([{ $match: { $expr: { $in: [{ $toString: "$_id" }, ownerIds] } } }, { $project: { name: 1 } }], { maxTimeMS: 3000 }).toArray() : []
  const names = new Map(owners.map((owner) => [owner._id.toString(), owner.name]))
  return { total, page, projects: records.map((project) => ({
    id: project._id.toString(), title: project.title, description: project.description ?? "", institution: project.institution ?? "",
    publisher: names.get(project.ownerId) || "Publisher", topics: project.topics ?? [],
    collaborators: 1 + (project.contributors ?? []).filter((name) => name.trim().toLocaleLowerCase() !== names.get(project.ownerId)?.trim().toLocaleLowerCase()).length,
  })) }
}

export async function getProjectListing(search: string, requestedPage: number, pageSize: number) {
  "use cache"
  cacheLife({ stale: 30, revalidate: 60, expire: 300 })
  cacheTag(PROJECT_LIST_TAG)
  const filter = listingMatch({ search })
  const collection = db.collection<ProjectRecord>("projects")
  const total = await collection.countDocuments(filter, { maxTimeMS: 3000 })
  const page = Math.min(Math.max(1, requestedPage), Math.max(1, Math.ceil(total / pageSize) || 1))
  const records = await collection.find(filter, { projection: { title: 1, description: 1, institution: 1, ownerId: 1, topics: 1, contributors: 1 }, maxTimeMS: 3000 }).sort({ createdAt: -1, _id: -1 }).skip((page - 1) * pageSize).limit(pageSize).toArray()
  return hydrateListing(records, total, page, pageSize)
}

export async function getFilteredProjectListing(requestedPage: number, pageSize: number, filters: ListingFilters) {
  const collection = db.collection<ProjectRecord>("projects")
  const filter = listingMatch(filters)
  const sort = filters.sort || "recent"
  const total = await collection.countDocuments(filter, { maxTimeMS: 3000 })
  const page = Math.min(Math.max(1, requestedPage), Math.max(1, Math.ceil(total / pageSize) || 1))
  const projection = { title: 1, description: 1, institution: 1, ownerId: 1, topics: 1, contributors: 1, createdAt: 1 }
  if (!listingSortNeedsMetrics(sort)) {
    const records = await collection.find(filter, { projection, maxTimeMS: 3000, ...(sort === "az" ? { collation: { locale: "en", strength: 2 } } : {}) }).sort(listingSortSpec(sort)).skip((page - 1) * pageSize).limit(pageSize).toArray()
    return hydrateListing(records, total, page, pageSize)
  }
  const records = await collection.aggregate<ProjectRecord>([
    { $match: filter },
    { $lookup: { from: "projectStars", localField: "_id", foreignField: "projectId", as: "_stars" } },
    { $lookup: { from: "projectViews", localField: "_id", foreignField: "projectId", as: "_views" } },
    { $addFields: { _starCount: { $size: "$_stars" }, _viewCount: { $size: "$_views" } } },
    { $sort: listingSortSpec(sort) },
    { $skip: (page - 1) * pageSize },
    { $limit: pageSize },
    { $project: { ...projection, _stars: 0, _views: 0, _starCount: 0, _viewCount: 0 } },
  ], { maxTimeMS: 3000 }).toArray()
  return hydrateListing(records, total, page, pageSize)
}

export async function getListingMetrics(ids: string[]) {
  const projectIds = ids.map((id) => new ObjectId(id))
  const [views, stars] = await Promise.all([
    db.collection("projectViews").aggregate<{ _id: ObjectId; count: number }>([{ $match: { projectId: { $in: projectIds } } }, { $group: { _id: "$projectId", count: { $sum: 1 } } }], { maxTimeMS: 3000 }).toArray(),
    db.collection("projectStars").aggregate<{ _id: ObjectId; count: number }>([{ $match: { projectId: { $in: projectIds } } }, { $group: { _id: "$projectId", count: { $sum: 1 } } }], { maxTimeMS: 3000 }).toArray(),
  ])
  return { views: new Map(views.map((item) => [item._id.toString(), item.count])), stars: new Map(stars.map((item) => [item._id.toString(), item.count])) }
}
