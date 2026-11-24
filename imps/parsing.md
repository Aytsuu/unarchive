# Intelligent manuscript parsing plan

Status: **approved for implementation**. Publishers may optionally select a manuscript PDF while publishing. The browser extracts and reviews its text without an LLM, and the publisher verifies the proposed metadata before the existing project submission. The PDF and extraction data stay in the browser; the manuscript is not uploaded, stored, or published.

## Preferred stack

1. **PDF.js (`pdfjs-dist`)** reads text runs, coordinates, page dimensions, and available font information.
2. **A custom semantic parser** reconstructs lines and paragraphs, detects sections, and ranks metadata candidates using a configurable rules registry.
3. **React-PDF** renders the original document, its selectable text layer, and source highlights beside the review form.
4. **The existing publish form** receives publisher-confirmed values and submits its current metadata payload.

Install compatible React-PDF and PDF.js versions together, and ensure the worker version matches the PDF.js version React-PDF uses:

```sh
npm install react-pdf pdfjs-dist
```

Example viewer setup (load this client component dynamically with server-side rendering disabled):

```tsx
"use client"

import { Document, Page, pdfjs } from "react-pdf"
import "react-pdf/dist/Page/TextLayer.css"

// Configure the worker in the same module that renders React-PDF.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString()

export function PdfPreview({ file }: { file: File }) {
  return <Document file={file}><Page pageNumber={1} renderTextLayer /></Document>
}
```

Use page-relative overlays for highlights and transform extracted PDF coordinates into the displayed page's viewport. Keep selectable text available to assign to a field. Configure any PDF.js resources required by the installed version locally so parsing does not send the manuscript to a third party.

## Parsing and review

Validate the PDF signature, a 100 MB size limit, and a 300-page limit. Explain invalid, encrypted, unreadable, and image-only files; users can always continue manually. Parse the first 10 pages progressively and search remaining pages when title, authors, or abstract are missing. Display progress, cancel stale work on replacement or removal, and release document resources.

Use label recognition, layout and typography, section boundaries, and contextual ranking together. Candidate results retain their value, score, and page-relative source locations so users can inspect alternatives. Recognize variants such as “Presented by,” “Proponents,” “Executive Summary,” and “Buod.” Consider cover placement, visual prominence, alignment, isolation, repetition, and plausible title length. Penalize candidates in tables of contents and bibliographies and distinguish authors from advisers and panel members. Scores are heuristic signals, not probabilities or guarantees.

The following illustrates the intended rules registry; calibrate it against representative fixtures:

```ts
const manuscriptRules = {
  initialPageCount: 10,
  maxPages: 300,
  maxFileBytes: 100 * 1024 * 1024,
  labels: {
    authors: ["presented by", "prepared by", "submitted by", "researchers", "proponents", "by"],
    abstract: ["abstract", "executive summary", "buod"],
    keywords: ["keywords", "key words"],
  },
  titleWeights: {
    coverPage: 30,
    prominentTypography: 20,
    centeredOrIsolated: 15,
    repeatedInFrontMatter: 15,
    plausibleLength: 10,
    excludedSection: -40,
  },
}
```

Propose title, abstract, institution, ordered authors, and completion year. Mark weak or ambiguous matches **Needs review** and retain alternatives. Map confirmed authors to existing contributor fields and ask the publisher to verify roles. Rank cover dates as completion candidates, recognize full and abbreviated month names, and let the publisher apply a detected month and year to the completion field. A year without a month remains a suggestion; never invent a month. Recognize an explicitly labeled short description when available, but do not generate one. Academic program, keywords, and technology stack have no matching saved project fields in this release.

The responsive review interface pairs the PDF with editable suggestions. Clicking a field or candidate navigates to and highlights its source; selecting document text allows assignment to a supported field. Preserve user edits while parsing continues. Provide keyboard-operable controls, accessible labels and status messages, and a stacked layout on smaller screens. Confirmed and manually entered values continue through existing validation and consent steps. No API or database schema change is needed.

## Verification

- Test title-page layout variation, alternate labels, repeated titles, competing dates, abstract boundaries, author versus adviser names, multi-line text, and missing or ambiguous fields.
- Verify highlights across page sizes, zoom, rotation, and multi-line selections, as well as field-to-source navigation and source-to-field assignment.
- Test progressive parsing, replacement, preservation of manual edits, file limits, corrupt and encrypted PDFs, and scanned PDFs without usable text.
- Exercise publishing with and without a PDF, existing validation and consent requirements, and the unchanged submission payload. Run relevant tests, lint, and the production build.
