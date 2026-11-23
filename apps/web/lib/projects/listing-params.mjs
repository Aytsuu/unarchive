export const LISTING_SORTS = Object.freeze(["az", "stars-desc", "views-desc", "stars-asc", "views-asc", "recent", "oldest"])

export const LISTING_SORT_OPTIONS = Object.freeze([
  { value: "az", label: "A-Z" },
  { value: "stars-desc", label: "Highest stars" },
  { value: "views-desc", label: "Highest reads" },
  { value: "stars-asc", label: "Lowest stars" },
  { value: "views-asc", label: "Lowest reads" },
  { value: "recent", label: "Most recent" },
  { value: "oldest", label: "Oldest" },
])

function parseYear(value) {
  return typeof value === "string" && /^(?!0000)\d{4}$/.test(value) ? Number(value) : null
}

export function listingSortNeedsMetrics(sort) {
  return sort === "stars-desc" || sort === "stars-asc" || sort === "views-desc" || sort === "views-asc"
}

/** @param {string} [sort] @returns {{ [key: string]: 1 | -1 }} */
export function listingSortSpec(sort) {
  if (sort === "az") return { title: 1, _id: 1 }
  if (sort === "oldest") return { createdAt: 1, _id: 1 }
  if (sort === "stars-desc") return { _starCount: -1, createdAt: -1, _id: -1 }
  if (sort === "stars-asc") return { _starCount: 1, createdAt: -1, _id: -1 }
  if (sort === "views-desc") return { _viewCount: -1, createdAt: -1, _id: -1 }
  if (sort === "views-asc") return { _viewCount: 1, createdAt: -1, _id: -1 }
  return { createdAt: -1, _id: -1 }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** @param {{ search?: string, topic?: string, yearFrom?: number | null, yearTo?: number | null, institutions?: string[] }} filters */
export function listingMatch({ search, topic, yearFrom, yearTo, institutions = [] }) {
  const filter = { withdrawnAt: { $exists: false } }
  const clauses = []
  if (search) clauses.push({ title: { $regex: escapeRegex(search), $options: "i" } })
  if (topic) clauses.push({ topics: topic })
  if (institutions.length) clauses.push({ institution: { $in: institutions } })
  if (yearFrom != null || yearTo != null) {
    const yearExpr = [{ $regexMatch: { input: { $ifNull: ["$dateEnded", ""] }, regex: /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/ } }]
    if (yearFrom != null) yearExpr.push({ $gte: [{ $toInt: { $substrBytes: ["$dateEnded", 0, 4] } }, yearFrom] })
    if (yearTo != null) yearExpr.push({ $lte: [{ $toInt: { $substrBytes: ["$dateEnded", 0, 4] } }, yearTo] })
    clauses.push({ $expr: { $and: yearExpr } })
  }
  if (clauses.length) filter.$and = clauses
  return filter
}

export function parseListingParams(params) {
  const search = (params.get("q") ?? "").trim().slice(0, 100)
  const size = Number(params.get("size"))
  const pageSize = [3, 6, 9, 12].includes(size) ? size : 3
  const rawPage = params.get("page") ?? "1"
  const parsedPage = /^\d+$/.test(rawPage) ? Number(rawPage) : 1
  const page = Number.isSafeInteger(parsedPage) ? Math.max(1, parsedPage) : 1
  const sortRaw = params.get("sort") ?? ""
  const sort = LISTING_SORTS.includes(sortRaw) ? sortRaw : ""
  const yearFrom = parseYear(params.get("from"))
  const yearTo = parseYear(params.get("to"))
  const inverted = yearFrom !== null && yearTo !== null && yearFrom > yearTo
  const institutions = [...new Set(params.getAll("institution").map((value) => value.trim().slice(0, 200)).filter(Boolean))].slice(0, 20)
  return { search, page, pageSize, sort, yearFrom: inverted ? null : yearFrom, yearTo: inverted ? null : yearTo, institutions }
}
