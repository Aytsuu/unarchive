export type ManuscriptField = "title" | "description" | "abstract" | "authors" | "institution" | "year"
export type SourceLocation = { pageNumber: number; x: number; y: number; width: number; height: number }
export type TextRun = { text: string; x: number; y: number; width: number; height: number; fontSize: number; fontName?: string }
export type ManuscriptPage = { pageNumber: number; width: number; height: number; runs: TextRun[] }
export type ManuscriptCandidate = { field: ManuscriptField; value: string; score: number; needsReview: boolean; locations: SourceLocation[]; monthYear?: string }
export type ManuscriptCandidates = Record<ManuscriptField, ManuscriptCandidate[]>

export const manuscriptRules = {
  labels: {
    authors: /^(?:presented by|prepared by|submitted by|researchers?|proponents?|authors?|by)\s*[:\-]?\s*(.*)$/i,
    abstract: /^(?:abstract|executive summary|buod)(?:\s*[:\-]\s*(.*))?\s*$/i,
    description: /^(?:short description|project description)\s*[:\-]\s*(.+)$/i,
  },
  boundary: /^(?:keywords?|key words|chapter\s+[\divxlc]+|introduction|table of contents|references|bibliography|acknowledg(?:e)?ments?|approval sheet|appendix|advis(?:e|o)r|panel|approved by|certification)\b/i,
  institution: /\b(?:university|college|institute|polytechnic|school)\b/i,
  titleWeights: { cover: 30, prominent: 20, centered: 15, repeat: 15, plausible: 10, excluded: -40 },
} as const

type Line = { text: string; x: number; y: number; width: number; height: number; fontSize: number; page: ManuscriptPage; locations: SourceLocation[] }

function reconstruct(page: ManuscriptPage): Line[] {
  const runs = page.runs.filter((r) => r.text.trim() && [r.x, r.y, r.width, r.height, r.fontSize].every(Number.isFinite))
    .slice().sort((a, b) => b.y - a.y || a.x - b.x)
  const rows: TextRun[][] = []
  for (const run of runs) {
    const row = rows.find((items) => Math.abs(items[0].y - run.y) <= Math.max(2, run.fontSize * 0.35))
    if (row) row.push(run)
    else rows.push([run])
  }
  return rows.map((row) => {
    const sorted = row.slice().sort((a, b) => a.x - b.x)
    let text = ""
    for (const [i, run] of sorted.entries()) {
      const previous = sorted[i - 1]
      const gap = previous ? run.x - (previous.x + previous.width) : 0
      if (previous && gap > Math.max(1, run.fontSize * 0.12) && !/\s$/.test(text) && !/^\s/.test(run.text)) text += " "
      text += run.text
    }
    const x = Math.min(...sorted.map((r) => r.x))
    const y = Math.min(...sorted.map((r) => r.y))
    const right = Math.max(...sorted.map((r) => r.x + r.width))
    const top = Math.max(...sorted.map((r) => r.y + r.height))
    return { text: text.replace(/\s+/g, " ").trim(), x, y, width: right - x, height: top - y, fontSize: Math.max(...sorted.map((r) => r.fontSize)), page, locations: sorted.map((r) => ({ pageNumber: page.pageNumber, x: r.x, y: r.y, width: r.width, height: r.height })) }
  }).sort((a, b) => b.y - a.y)
}

function candidate(field: ManuscriptField, value: string, score: number, lines: Line[]): ManuscriptCandidate {
  return { field, value: value.trim(), score, needsReview: true, locations: lines.flatMap((line) => line.locations) }
}

const monthNames = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]
const monthPattern = "(?:january|jan|february|feb|march|mar|april|apr|may|june|jun|july|jul|august|aug|september|sept|sep|october|oct|november|nov|december|dec)"
const datePattern = new RegExp(`\\b${monthPattern}\\.?\\s+(?:\\d{1,2}(?:st|nd|rd|th)?[,]?\\s+)?(?:19|20)\\d{2}\\b|\\b(?:19|20)\\d{2}\\s+${monthPattern}\\b\\.?`, "gi")

function yearCandidates(line: Line, excluded: boolean): ManuscriptCandidate[] {
  const dates = Array.from(line.text.matchAll(datePattern))
  return Array.from(line.text.matchAll(/\b(?:19|20)\d{2}\b/g), (yearMatch) => {
    const year = yearMatch[0]
    const date = dates.find((match) => match.index !== undefined && yearMatch.index >= match.index && yearMatch.index < match.index + match[0].length)
    const monthMatch = date?.[0].match(new RegExp(`\\b${monthPattern}\\b`, "i"))
    const monthIndex = monthMatch ? monthNames.indexOf(monthMatch[0].slice(0, 3).toLowerCase()) : -1
    const standalone = date && line.text.trim().replace(/[.,]$/, "") === date[0].trim().replace(/[.,]$/, "")
    const score = (line.page.pageNumber === 1 ? 65 : 35) + (date ? 10 : 0) + (standalone ? 15 : 0) - (excluded ? 40 : 0)
    const result = candidate("year", date?.[0] ?? year, score, [line])
    return monthIndex >= 0 ? { ...result, monthYear: `${year}-${String(monthIndex + 1).padStart(2, "0")}` } : result
  })
}

function titleEligible(line: Line): boolean {
  return line.text.length >= 8 && line.text.length <= 200 && /[a-z]/i.test(line.text) &&
    !manuscriptRules.institution.test(line.text) &&
    !/^(?:abstract|table of contents|approval|acknowledg|chapter|references|bibliography|appendix|advis|by\b|presented|submitted|prepared|a capstone|in partial|of the requirement|bachelor|college of)/i.test(line.text) &&
    !/^\d/.test(line.text) && !/\.{3,}\s*\d+\s*$/.test(line.text)
}

function institutionEligible(line: Line): boolean {
  return manuscriptRules.institution.test(line.text) && line.text.length <= 140 &&
    line.text.split(/\s+/).length <= 12 &&
    !/^(?:the|this|these|our|their|at|in|from|according|students|researchers)\b/i.test(line.text) &&
    !/\b(?:conducted|participated|respondents|researchers|according|revealed|research|study|students)\b/i.test(line.text) &&
    !/[!?;:]$/.test(line.text)
}

function sectionLines(pages: Line[][], pageIndex: number, start: number): Line[] {
  const selected: Line[] = []
  let length = 0
  for (let index = pageIndex; index < pages.length; index++) {
    if (index > pageIndex && (!pages[index].length || pages[index][0].page.pageNumber !== pages[index - 1][0]?.page.pageNumber + 1)) break
    for (const line of pages[index].slice(index === pageIndex ? start + 1 : 0)) {
      if (/^(?:\d+|[ivxlcdm]+)$/i.test(line.text)) continue
      if (manuscriptRules.boundary.test(line.text) || manuscriptRules.labels.abstract.test(line.text)) return selected
      selected.push(line)
      length += line.text.length + 1
      if (length >= 10000) return selected
    }
  }
  return selected
}

function authorLines(lines: Line[], start: number): Line[] {
  const chosen: Line[] = []
  for (let i = start + 1; i < lines.length && chosen.length < 50; i++) {
    const line = lines[i]
    if (manuscriptRules.boundary.test(line.text) || /\b(?:19|20)\d{2}\b/.test(line.text) || manuscriptRules.institution.test(line.text)) break
    const next = lines[i + 1]
    if ((next && /^(?:advis(?:e|o)r|panel)/i.test(next.text) && line.y - next.y <= line.fontSize * 1.8) || /\b(?:ph\.?d|professor|prof\.|dr\.)\b/i.test(line.text)) break
    if (line.text.length > 100 || /[.!?]/.test(line.text)) break
    chosen.push(line)
  }
  return chosen
}

function rank(candidates: ManuscriptCandidate[]): ManuscriptCandidate[] {
  const unique = new Map<string, { best: ManuscriptCandidate; locations: SourceLocation[]; frontOccurrences: number }>()
  for (const item of candidates) {
    if (!item.value) continue
    const key = item.value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()
    const old = unique.get(key)
    const front = item.locations.some((location) => location.pageNumber <= 10) ? 1 : 0
    if (!old) unique.set(key, { best: item, locations: item.locations, frontOccurrences: front })
    else unique.set(key, { best: item.score > old.best.score ? item : old.best, locations: [...old.locations, ...item.locations], frontOccurrences: old.frontOccurrences + front })
  }
  const ranked = [...unique.values()].map(({ best, locations, frontOccurrences }) => ({
    ...best, locations, score: best.score + (best.field === "title" && frontOccurrences > 1 ? manuscriptRules.titleWeights.repeat : 0),
  })).sort((a, b) => b.score - a.score)
  const prioritizeFront = ["title", "authors", "institution", "year"].includes(ranked[0]?.field ?? "")
  const front = ranked.filter((item) => item.locations.some((location) => location.pageNumber <= 10))
  const sorted = (prioritizeFront && front.length ? front : ranked).slice(0, 10)
  return sorted.map((item, index) => ({ ...item, needsReview: item.score < 60 || (prioritizeFront && !item.locations.some((location) => location.pageNumber <= 10)) || (index === 0 && sorted.length > 1 && item.score - sorted[1].score < 15) }))
}

export function parseManuscript(pages: ManuscriptPage[]): ManuscriptCandidates {
  const found: ManuscriptCandidates = { title: [], description: [], abstract: [], authors: [], institution: [], year: [] }
  const orderedPages = pages.slice().sort((a, b) => a.pageNumber - b.pageNumber)
  const pageLines = orderedPages.map(reconstruct)
  for (const [pageIndex, page] of orderedPages.entries()) {
    const lines = pageLines[pageIndex]
    const sizes = lines.map((line) => line.fontSize).sort((a, b) => a - b)
    const median = sizes[Math.floor(sizes.length / 2)] ?? 12
    const grouped = new Set<number>()
    let excluded = false
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (/^(?:table of contents|references|bibliography)\b/i.test(line.text)) excluded = true
      const abstract = line.text.match(manuscriptRules.labels.abstract)
      if (abstract) {
        const content = sectionLines(pageLines, pageIndex, i)
        const value = [abstract[1], ...content.map((part) => part.text)].filter(Boolean).join(" ")
        if (value) found.abstract.push(candidate("abstract", value, 90, abstract[1] ? [line, ...content] : content))
      }
      const authors = line.text.match(manuscriptRules.labels.authors)
      if (authors) {
        const content = authorLines(lines, i)
        const value = [authors[1], ...content.map((part) => part.text)].filter(Boolean).join("\n")
        if (value) found.authors.push(candidate("authors", value, page.pageNumber <= 10 ? 70 : 35, authors[1] ? [line, ...content] : content))
      }
      const description = line.text.match(manuscriptRules.labels.description)
      if (description) found.description.push(candidate("description", description[1], 70, [line]))
      if (institutionEligible(line) && !excluded) found.institution.push(candidate("institution", line.text, (page.pageNumber === 1 ? 75 : page.pageNumber <= 10 ? 50 : 30) + (/\buniversity\b/i.test(line.text) ? 10 : 0), [line]))
      found.year.push(...yearCandidates(line, excluded))
      if (grouped.has(i) || !titleEligible(line)) continue
      const group = [line]
      const next = lines[i + 1]
      if (next && titleEligible(next) && line.y - next.y <= Math.max(line.fontSize, next.fontSize) * 1.8 && Math.abs(line.fontSize - next.fontSize) <= median * 0.2) {
        group.push(next)
        grouped.add(i + 1)
      }
      const value = group.map((part) => part.text).join(" ")
      if (value.length > 200) continue
      const prominent = line.fontSize > median * 1.12
      const centered = Math.abs((line.x + line.width / 2) - page.width / 2) < page.width * 0.16
      const weight = manuscriptRules.titleWeights
      const score = (page.pageNumber === 1 ? weight.cover : 0) + (prominent ? weight.prominent : 0) + (centered ? weight.centered : 0) + weight.plausible - (excluded ? 40 : 0)
      if (score >= 10) found.title.push(candidate("title", value, score, group))
    }
  }
  return { title: rank(found.title), description: rank(found.description), abstract: rank(found.abstract), authors: rank(found.authors), institution: rank(found.institution), year: rank(found.year) }
}
