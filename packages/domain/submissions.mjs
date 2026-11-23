import { ObjectId } from "mongodb"

export const SUBMISSIONS_COLLECTION = "projectSubmissions"

const DEMO_SUBMISSIONS = [
  {
    seedKey: "moderation-demo-mangroves",
    snapshot: {
      projectType: "thesis",
      title: "Coastal Mangrove Recovery After Aquaculture Retreat",
      description: "Tracks how retired ponds return to mangrove cover and which restoration practices hold through the first storm season.",
      abstract: "Retired aquaculture ponds along the coast were surveyed for seedling survival, soil salinity, and storm damage. The study compares assisted planting with sites left to regenerate on their own.",
      institution: "University of the Philippines Visayas",
      topics: ["Environment & Sustainability", "Agriculture & Food"],
      contributors: ["Elena Cruz"],
      links: ["https://example.com/mangrove-recovery"],
      dateStarted: "2023-06",
      dateEnded: "2025-03",
    },
  },
  {
    seedKey: "moderation-demo-sensors",
    snapshot: {
      projectType: "thesis",
      title: "Shared Water Sensors for Informal Settlements",
      description: "A low-cost sensor network that lets neighbors check turbidity and chlorine before they draw household water.",
      abstract: "The prototype places shared sensors at communal taps and publishes a simple status that residents can read without an account. Field notes cover installation, calibration, and who maintains the devices.",
      institution: "Mapúa University",
      topics: ["Smart Cities & IoT", "Health & Medicine"],
      contributors: ["Paolo Reyes", "Mina Santos"],
      links: ["https://example.com/shared-water-sensors"],
      dateStarted: "2024-01",
      dateEnded: "2025-11",
    },
  },
  {
    seedKey: "moderation-demo-histories",
    snapshot: {
      projectType: "thesis",
      title: "Neighborhood Oral Histories After Displacement",
      description: "Recorded interviews with families who rebuilt neighborhood routines after a forced relocation.",
      abstract: "The archive gathers consenting oral histories, maps the places people still name, and describes how a community keeps records when the original streets are gone.",
      institution: "University of the Philippines Diliman",
      topics: ["Education & Learning", "Public Safety & Governance"],
      contributors: ["Liza Navarro"],
      links: ["https://example.com/oral-histories"],
      dateStarted: "2022-08",
      dateEnded: "2024-12",
    },
  },
]

export function pendingSubmissionFilter() {
  return { status: "pending" }
}

export function demoSubmissions(ownerId, submittedAt = new Date()) {
  if (typeof ownerId !== "string" || !ownerId.trim()) throw new Error("A submission needs an owner.")
  return DEMO_SUBMISSIONS.map((item, index) => ({
    ownerId,
    status: "pending",
    seedKey: item.seedKey,
    submittedAt: new Date(submittedAt.getTime() - index * 60_000),
    snapshot: { ...item.snapshot, topics: [...item.snapshot.topics], contributors: [...item.snapshot.contributors], links: [...item.snapshot.links] },
  }))
}

export function toQueueItem(record, ownerName) {
  return {
    id: record._id.toString(),
    title: record.snapshot.title,
    description: record.snapshot.description || "",
    institution: record.snapshot.institution || "",
    ownerName: ownerName?.trim() || "Member",
    submittedAt: record.submittedAt.toISOString(),
    status: "pending",
  }
}

async function ownerNames(db, ownerIds) {
  if (!ownerIds.length) return new Map()
  const users = await db.collection("user").aggregate([
    { $match: { $expr: { $in: [{ $toString: "$_id" }, ownerIds] } } },
    { $project: { name: 1 } },
  ], { maxTimeMS: 3000 }).toArray()
  return new Map(users.map((user) => [String(user._id), user.name]))
}

export async function listPendingSubmissions(db) {
  const records = await db.collection(SUBMISSIONS_COLLECTION)
    .find(pendingSubmissionFilter(), { maxTimeMS: 3000 })
    .sort({ submittedAt: 1, _id: 1 })
    .limit(100)
    .toArray()
  const names = await ownerNames(db, [...new Set(records.map((record) => record.ownerId).filter(Boolean))])
  return records.map((record) => toQueueItem(record, names.get(record.ownerId)))
}

function submissionObjectId(id) {
  if (typeof id !== "string" || !/^[a-f0-9]{24}$/i.test(id)) return null
  return new ObjectId(id)
}

function reviewDetails(record, ownerName) {
  return {
    id: record._id.toString(),
    title: record.snapshot.title,
    description: record.snapshot.description || "",
    institution: record.snapshot.institution || "",
    ownerName: ownerName?.trim() || "Member",
    submittedAt: record.submittedAt instanceof Date ? record.submittedAt.toISOString() : "",
    status: record.status,
    revisionReason: typeof record.revisionReason === "string" ? record.revisionReason : "",
    decidedAt: record.decidedAt instanceof Date ? record.decidedAt.toISOString() : "",
    abstract: record.snapshot.abstract || "",
    topics: Array.isArray(record.snapshot.topics) ? record.snapshot.topics : [],
    contributors: Array.isArray(record.snapshot.contributors) ? record.snapshot.contributors : [],
    links: Array.isArray(record.snapshot.links) ? record.snapshot.links : [],
    dateStarted: record.snapshot.dateStarted || "",
    dateEnded: record.snapshot.dateEnded || "",
  }
}

export function revisionReasonText(reason) {
  if (typeof reason !== "string") return null
  const text = reason.trim()
  if (!text || text.length > 4000) return null
  return text
}

export async function getSubmission(db, id) {
  const objectId = submissionObjectId(id)
  if (!objectId) return null
  const record = await db.collection(SUBMISSIONS_COLLECTION).findOne({ _id: objectId }, { maxTimeMS: 3000 })
  if (!record?.snapshot || typeof record.snapshot.title !== "string") return null
  if (record.status !== "pending" && record.status !== "approved" && record.status !== "changes_requested") return null
  const names = await ownerNames(db, [record.ownerId])
  return reviewDetails(record, names.get(record.ownerId))
}

export function pendingSubmissionDocument(input) {
  if (!input?.id || typeof input.id.toString !== "function") throw new Error("A submission needs an id.")
  if (typeof input.ownerId !== "string" || !input.ownerId.trim()) throw new Error("A submission needs an owner.")
  if (!(input.submittedAt instanceof Date)) throw new Error("A submission needs a time.")
  const project = input.project
  if (!project || typeof project.title !== "string" || !project.title.trim()) throw new Error("A submission needs a title.")
  const list = (value) => Array.isArray(value) ? [...value] : []
  return {
    _id: input.id,
    ownerId: input.ownerId,
    status: "pending",
    submittedAt: input.submittedAt,
    snapshot: {
      projectType: project.projectType || "thesis",
      title: project.title,
      description: project.description || "",
      abstract: project.abstract || "",
      institution: project.institution || "",
      topics: list(project.topics),
      contributors: list(project.contributors),
      links: list(project.links),
      referenceProjectIds: list(project.referenceProjectIds),
      dateStarted: project.dateStarted || "",
      dateEnded: project.dateEnded || "",
      demos: list(input.demos),
    },
    ...(project.consents ? { consents: project.consents } : {}),
    ...(input.idempotencyDigest ? { idempotencyDigest: input.idempotencyDigest } : {}),
  }
}

export async function insertPendingSubmission(db, input) {
  const document = pendingSubmissionDocument(input)
  await db.collection(SUBMISSIONS_COLLECTION).insertOne(document)
  return document
}

function textList(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).map((item) => item) : []
}

function duplicateKey(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === 11000
}

export function publishedProjectFromSubmission(record, publishedAt) {
  if (!record?._id) throw new Error("A submission needs an id.")
  if (typeof record.ownerId !== "string" || !record.ownerId.trim()) throw new Error("A submission needs an owner.")
  const snapshot = record.snapshot
  if (!snapshot || typeof snapshot.title !== "string" || !snapshot.title.trim()) throw new Error("A submission needs a title.")
  if (!(publishedAt instanceof Date)) throw new Error("A publication needs a time.")
  const project = {
    _id: record._id,
    ownerId: record.ownerId,
    projectType: typeof snapshot.projectType === "string" && snapshot.projectType.trim() ? snapshot.projectType : "thesis",
    title: snapshot.title,
    description: typeof snapshot.description === "string" ? snapshot.description : "",
    contributors: textList(snapshot.contributors),
    links: textList(snapshot.links),
    demos: textList(snapshot.demos),
    createdAt: publishedAt,
    updatedAt: publishedAt,
    currentVersion: 1,
  }
  if (typeof snapshot.abstract === "string" && snapshot.abstract) project.abstract = snapshot.abstract
  if (typeof snapshot.institution === "string" && snapshot.institution) project.institution = snapshot.institution
  if (typeof snapshot.dateStarted === "string" && snapshot.dateStarted) project.dateStarted = snapshot.dateStarted
  if (typeof snapshot.dateEnded === "string" && snapshot.dateEnded) project.dateEnded = snapshot.dateEnded
  const topics = textList(snapshot.topics)
  if (topics.length) project.topics = topics
  const referenceProjectIds = textList(snapshot.referenceProjectIds)
  if (referenceProjectIds.length) project.referenceProjectIds = referenceProjectIds
  return project
}

export function publishedVersionFromProject(project, publishedAt) {
  const snapshot = { title: project.title, demos: [...project.demos], createdAt: publishedAt }
  for (const key of ["description", "abstract", "institution", "dateStarted", "dateEnded", "projectType", "topics", "referenceProjectIds", "contributors", "links"]) {
    if (project[key] === undefined) continue
    snapshot[key] = Array.isArray(project[key]) ? [...project[key]] : project[key]
  }
  return { projectId: project._id, version: 1, kind: "published", capturedAt: publishedAt, snapshot }
}

export async function publishApprovedSubmission(db, record) {
  const publishedAt = record?.decidedAt instanceof Date ? record.decidedAt : record?.submittedAt instanceof Date ? record.submittedAt : new Date()
  const project = publishedProjectFromSubmission(record, publishedAt)
  const projects = db.collection("projects")
  const versions = db.collection("projectVersions")
  const existingProject = await projects.findOne({ _id: project._id }, { projection: { _id: 1 }, maxTimeMS: 3000 })
  let insertedProject = false
  try {
    if (!existingProject) {
      await projects.insertOne(project)
      insertedProject = true
    }
    const existingVersion = await versions.findOne({ projectId: project._id, version: 1 }, { projection: { _id: 1 }, maxTimeMS: 3000 })
    if (!existingVersion) await versions.insertOne(publishedVersionFromProject(project, publishedAt))
  } catch (error) {
    if (duplicateKey(error)) return
    if (insertedProject) await projects.deleteOne({ _id: project._id })
    throw error
  }
}

export async function promoteApprovedSubmissions(db) {
  const records = await db.collection(SUBMISSIONS_COLLECTION).find({ status: "approved" }, { maxTimeMS: 3000 }).toArray()
  const ids = records.map((record) => record._id).filter(Boolean)
  if (!ids.length) return 0
  const existing = await db.collection("projects").find({ _id: { $in: ids } }, { projection: { _id: 1 }, maxTimeMS: 3000 }).toArray()
  const published = new Set(existing.map((project) => project._id.toString()))
  let count = 0
  for (const record of records) {
    if (!record?._id || published.has(record._id.toString())) continue
    if (!record.snapshot || typeof record.snapshot.title !== "string" || !record.snapshot.title.trim()) continue
    await publishApprovedSubmission(db, record)
    count += 1
  }
  return count
}

export async function getPendingSubmission(db, id) {
  const submission = await getSubmission(db, id)
  if (!submission || submission.status !== "pending") return null
  return submission
}

export async function decideSubmission(db, input) {
  const objectId = submissionObjectId(input?.id)
  if (!objectId) return { ok: false, error: "not_found" }
  const moderatorId = typeof input?.moderatorId === "string" ? input.moderatorId.trim() : ""
  if (!moderatorId) throw new Error("A decision needs a moderator.")
  const action = input?.action
  if (action !== "approve" && action !== "request_revision") return { ok: false, error: "invalid" }
  const decidedAt = input?.decidedAt instanceof Date ? input.decidedAt : new Date()
  const update = { decidedBy: moderatorId, decidedAt }
  if (action === "approve") {
    update.status = "approved"
  } else {
    const revisionReason = revisionReasonText(input?.reason)
    if (!revisionReason) return { ok: false, error: "reason_required" }
    update.status = "changes_requested"
    update.revisionReason = revisionReason
  }
  const result = await db.collection(SUBMISSIONS_COLLECTION).updateOne(
    { _id: objectId, status: "pending" },
    { $set: update },
  )
  if (result.matchedCount === 1) {
    if (update.status === "approved") {
      const record = await db.collection(SUBMISSIONS_COLLECTION).findOne({ _id: objectId }, { maxTimeMS: 3000 })
      if (record?.snapshot && typeof record.snapshot.title === "string" && record.snapshot.title.trim()) {
        try {
          await publishApprovedSubmission(db, record)
        } catch (error) {
          const published = await db.collection("projects").findOne({ _id: objectId }, { projection: { _id: 1 }, maxTimeMS: 3000 })
          if (!published) {
            await db.collection(SUBMISSIONS_COLLECTION).updateOne(
              { _id: objectId, status: "approved", decidedBy: moderatorId },
              { $set: { status: "pending" }, $unset: { decidedBy: "", decidedAt: "" } },
            )
          }
          console.error("Approved submission could not be published")
          throw error
        }
      }
    }
    return { ok: true, status: update.status }
  }
  const existing = await db.collection(SUBMISSIONS_COLLECTION).findOne(
    { _id: objectId },
    { projection: { status: 1 }, maxTimeMS: 3000 },
  )
  if (!existing) return { ok: false, error: "not_found" }
  return { ok: false, error: "conflict" }
}
