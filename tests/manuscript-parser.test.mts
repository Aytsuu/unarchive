import assert from "node:assert/strict"
import { test } from "node:test"
import { parseManuscript } from "../apps/web/lib/manuscript/parser.ts"

const page = (pageNumber: number, lines: Array<[string, number, number?, number?]>) => ({
  pageNumber, width: 600, height: 800,
  runs: lines.map(([text, y, fontSize = 12, x = 150]) => ({ text, x, y, width: Math.min(text.length * fontSize * 0.5, 500), height: fontSize, fontSize })),
})

test("ranks cover titles, captures authors and stops before adviser", () => {
  const result = parseManuscript([page(1, [["Smart Campus Resource System", 680, 21], ["Example University", 600, 13], ["Presented by", 450], ["Ana Santos", 420], ["Ben Reyes", 400], ["Adviser", 350], ["Prof. Smith", 330], ["November 2024", 200]])])
  assert.equal(result.title[0]?.value, "Smart Campus Resource System")
  assert.equal(result.institution[0]?.value, "Example University")
  assert.match(result.authors[0]?.value ?? "", /Ana Santos\nBen Reyes/)
  assert.doesNotMatch(result.authors[0]?.value ?? "", /Smith/)
  assert.equal(result.year[0]?.value, "November 2024")
  assert.equal(result.year[0]?.monthYear, "2024-11")
  assert.equal(result.title[0]?.locations[0]?.pageNumber, 1)
})

test("abstract boundaries recognize alternate headings and exclude keywords", () => {
  const result = parseManuscript([page(2, [["BUOD", 720], ["This research describes a campus system.", 690], ["It improves access to resources.", 670], ["Keywords: campus, resources", 630], ["CHAPTER 1", 600]])])
  assert.match(result.abstract[0]?.value ?? "", /This research describes/)
  assert.doesNotMatch(result.abstract[0]?.value ?? "", /Keywords|CHAPTER/)
})

test("marks close title candidates for review and handles missing fields", () => {
  const result = parseManuscript([page(1, [["Campus Information Management System", 700, 20], ["An Alternative Research Project", 600, 20]])])
  assert.ok(result.title.length >= 2)
  assert.equal(result.title[0].needsReview, true)
  assert.deepEqual(parseManuscript([]).abstract, [])
})

test("joins wrapped cover title and excludes table of contents", () => {
  const result = parseManuscript([
    page(1, [["SECURADO: DIGITAL SECURITY AND REAL-TIME TRACKING FOR", 720, 16, 80], ["BARANGAY GOVERNANCE", 700, 16, 200], ["By", 420], ["Joshua Ganzo", 400], ["Paolo Araneta", 380], ["Narcisan Galamiton Ph.D.", 300], ["Adviser", 280]]),
    page(2, [["TABLE OF CONTENTS", 750], ["SECURADO: DIGITAL SECURITY AND REAL-TIME TRACKING FOR", 700], ["BARANGAY GOVERNANCE ....... 1", 680]]),
  ])
  assert.match(result.title[0]?.value ?? "", /FOR BARANGAY GOVERNANCE/)
  assert.doesNotMatch(result.authors[0]?.value ?? "", /Galamiton/)
})

test("repeated body content cannot displace front-matter title or date", () => {
  const cover = page(1, [["A Useful Project for Community Safety", 700, 16], ["November 2025", 200]])
  const body = Array.from({ length: 40 }, (_, i) => page(i + 20, [["No. of Modules 1", 700, 22], ["Citation 2020", 500]]))
  const result = parseManuscript([cover, ...body])
  assert.equal(result.title[0]?.value, "A Useful Project for Community Safety")
  assert.equal(result.year[0]?.value, "November 2025")
  assert.equal(result.year[0]?.monthYear, "2025-11")
  assert.ok(result.title.length <= 10)
  assert.deepEqual(result.abstract, [])
})

test("body author labels remain untrusted and institution prose is excluded", () => {
  const front = page(1, [["By", 500], ["Alice Rivera", 480], ["Example University", 400]])
  const body = page(162, [["By", 700], ["Someone Else", 680], ["The researchers at another university conducted this study", 600]])
  const both = parseManuscript([front, body])
  assert.equal(both.authors.length, 1)
  assert.equal(both.authors[0]?.value, "Alice Rivera")
  assert.equal(both.institution.length, 1)
  const fallback = parseManuscript([body])
  assert.equal(fallback.authors[0]?.needsReview, true)
  assert.deepEqual(fallback.institution, [])
})

test("abstract continues across pages and stops at the next heading", () => {
  const result = parseManuscript([
    page(3, [["Abstract", 720], ["This research begins here.", 690], ["Its first page ends here.", 40]]),
    page(4, [["iv", 780], ["The abstract continues on the next page.", 730], ["Keywords: safety, community", 680], ["Not part of abstract", 650]]),
  ])
  assert.match(result.abstract[0]?.value ?? "", /continues on the next page/)
  assert.doesNotMatch(result.abstract[0]?.value ?? "", /Keywords|Not part/)
  assert.ok(result.abstract[0]?.locations.some((location) => location.pageNumber === 4))
})

test("grouping a wrapped title does not skip year detection on its second line", () => {
  const result = parseManuscript([page(1, [["A COMMUNITY SYSTEM FOR", 700, 16], ["SAFETY VISION 2025", 680, 16]])])
  assert.equal(result.title[0]?.value, "A COMMUNITY SYSTEM FOR SAFETY VISION 2025")
  assert.equal(result.year[0]?.value, "2025")
})

test("prefers a cover completion date to years in title and body", () => {
  const result = parseManuscript([
    page(1, [["SAFETY VISION 2024", 700, 16], ["November 2025", 200]]),
    page(2, [["Submitted in March 2022", 500]]),
  ])
  assert.equal(result.year[0]?.value, "November 2025")
  assert.equal(result.year[0]?.monthYear, "2025-11")
  assert.equal(result.year[0]?.locations[0]?.pageNumber, 1)
})

test("recognizes short and long month names without inventing missing months", () => {
  for (const [input, expected] of [["Jan. 2025", "2025-01"], ["Sept 2024", "2024-09"], ["September 2024", "2024-09"], ["Dec 15, 2023", "2023-12"], ["2022 November", "2022-11"]]) {
    const result = parseManuscript([page(1, [[input, 200]])])
    assert.equal(result.year[0]?.value, input)
    assert.equal(result.year[0]?.monthYear, expected)
  }
  const yearOnly = parseManuscript([page(1, [["2024", 200]])]).year[0]
  assert.equal(yearOnly?.value, "2024")
  assert.equal(yearOnly?.monthYear, undefined)
})
