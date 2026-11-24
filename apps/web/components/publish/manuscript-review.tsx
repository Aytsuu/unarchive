"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"
import "react-pdf/dist/Page/TextLayer.css"
import { parseManuscript, type ManuscriptPage, type ManuscriptCandidate, type ManuscriptField } from "@/lib/manuscript/parser"

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()

type ApplyField = "title" | "description" | "abstract" | "institution" | "authors" | "year"
type Results = ReturnType<typeof parseManuscript>
type Location = ManuscriptCandidate["locations"][number]
const fields: ManuscriptField[] = ["title", "description", "abstract", "authors", "institution", "year"]
const labels: Record<ManuscriptField, string> = { title: "Title", description: "Short description", abstract: "Abstract", authors: "Authors", institution: "Institution", year: "Completion year" }
const empty = (): Results => ({ title: [], description: [], abstract: [], authors: [], institution: [], year: [] })

async function extractPage(pdf: PDFDocumentProxy, pageNumber: number): Promise<ManuscriptPage> {
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1, rotation: 0 })
  const content = await page.getTextContent()
  return {
    pageNumber, width: viewport.width, height: viewport.height,
    runs: content.items.flatMap((item) => {
      if (!("str" in item) || !item.str.trim()) return []
      const size = Math.hypot(item.transform[2], item.transform[3]) || item.height || 1
      return [{ text: item.str, x: item.transform[4], y: item.transform[5], width: item.width, height: item.height || size, fontSize: size, fontName: item.fontName }]
    }),
  }
}

export function ManuscriptReview({ onApply, onSourcesReset, sourceRequest }: { onApply: (field: ApplyField, value: string) => boolean | void; onSourcesReset?: () => void; sourceRequest?: { field: ApplyField; sequence: number } }) {
  const [file, setFile] = useState<File | null>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [page, setPage] = useState<PDFPageProxy | null>(null)
  const [results, setResults] = useState<Results>(empty)
  const [active, setActive] = useState<ManuscriptCandidate | null>(null)
  const [expanded, setExpanded] = useState<ManuscriptField[]>([])
  const [selectedText, setSelectedText] = useState("")
  const [selectedLocations, setSelectedLocations] = useState<Location[]>([])
  const [target, setTarget] = useState<ApplyField>("title")
  const [message, setMessage] = useState("")
  const [progress, setProgress] = useState("")
  const [width, setWidth] = useState(600)
  const sequence = useRef(0)
  const container = useRef<HTMLDivElement>(null)
  const pageBox = useRef<HTMLDivElement>(null)
  const appliedSources = useRef<Partial<Record<ApplyField, ManuscriptCandidate>>>({})

  useEffect(() => {
    const element = container.current
    if (!element || !file) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.min(700, entry.contentRect.width - 24))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [file])

  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    pdf.getPage(pageNumber).then((next) => { if (!cancelled) setPage(next) }).catch(() => { if (!cancelled) setMessage("Unable to display this page.") })
    return () => { cancelled = true }
  }, [pdf, pageNumber])

  useEffect(() => () => { sequence.current++ }, [])

  useEffect(() => {
    if (!sourceRequest) return
    const source = appliedSources.current[sourceRequest.field]
    if (!source) return
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      setActive(source)
      if (source.locations[0]) setPageNumber(source.locations[0].pageNumber)
      pageBox.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
    })
    return () => { cancelled = true }
  }, [sourceRequest])

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]
    event.target.value = ""
    if (!next) return
    const id = ++sequence.current
    appliedSources.current = {}
    onSourcesReset?.()
    setFile(null); setPdf(null); setPage(null); setPageNumber(1); setResults(empty()); setActive(null); setExpanded([])
    setSelectedText(""); setSelectedLocations([]); setMessage(""); setProgress("")
    if (next.size > 100 * 1024 * 1024) return setMessage("Choose a PDF no larger than 100 MB.")
    const signature = new TextDecoder().decode(await next.slice(0, 5).arrayBuffer())
    if (id !== sequence.current) return
    if (signature !== "%PDF-") return setMessage("Choose a valid PDF document.")
    setFile(next)
  }

  async function loaded(document: PDFDocumentProxy) {
    const id = sequence.current
    if (document.numPages > 300) { setFile(null); setMessage("Choose a PDF with no more than 300 pages."); return }
    setPdf(document)
    setProgress("Reading manuscript…")
    const pages: ManuscriptPage[] = []
    try {
      for (let number = 1; number <= document.numPages; number++) {
        const extracted = await extractPage(document, number)
        if (id !== sequence.current) return
        pages.push(extracted)
        setProgress(`Read ${number} of ${document.numPages} pages`)
        if (number <= 10 || number % 10 === 0 || number === document.numPages) {
          const candidates = parseManuscript(pages)
          setResults(candidates)
          if (number >= 10 && candidates.title.length && candidates.authors.length && candidates.abstract.length) break
        }
        // Let rendering and document replacement run between extraction steps.
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
        if (id !== sequence.current) return
      }
      if (id !== sequence.current) return
      setProgress("Parsing complete. Review every suggestion before using it.")
      if (!pages.some((item) => item.runs.length)) setMessage("No selectable text was found. This may be a scanned PDF; enter the details manually.")
    } catch {
      if (id === sequence.current) { setProgress(""); setMessage("Unable to extract text from this PDF. You can enter the details manually.") }
    }
  }

  function removeFile() {
    sequence.current++
    appliedSources.current = {}
    onSourcesReset?.()
    setFile(null); setPdf(null); setPage(null); setResults(empty()); setActive(null); setExpanded([]); setSelectedText(""); setSelectedLocations([]); setProgress(""); setMessage("")
  }

  function showCandidate(candidate: ManuscriptCandidate) {
    setActive(candidate)
    if (candidate.locations[0]) setPageNumber(candidate.locations[0].pageNumber)
    pageBox.current?.scrollIntoView({ behavior: "smooth", block: "nearest" })
  }

  const captureSelection = useCallback(() => {
    const selection = window.getSelection()
    const wrapper = pageBox.current?.querySelector(".react-pdf__Page")
    if (!selection || selection.isCollapsed || !wrapper || !page || !wrapper.contains(selection.anchorNode) || !wrapper.contains(selection.focusNode)) return
    const value = selection.toString().trim()
    if (!value) return
    const rect = wrapper.getBoundingClientRect()
    const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width })
    const locations = Array.from(selection.getRangeAt(0).getClientRects()).filter((r) => r.width > 0 && r.height > 0).map((r) => {
      const [x1, y1] = viewport.convertToPdfPoint(r.left - rect.left, r.top - rect.top)
      const [x2, y2] = viewport.convertToPdfPoint(r.right - rect.left, r.bottom - rect.top)
      return { pageNumber, x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }
    })
    setSelectedText(value); setSelectedLocations(locations); setActive(null)
  }, [page, pageNumber, width])

  const viewport = page?.getViewport({ scale: width / page.getViewport({ scale: 1 }).width })
  const highlights = active
    ? active.locations.map((location) => ({ location, label: labels[active.field] }))
    : selectedLocations.length
      ? selectedLocations.map((location) => ({ location, label: "Selected text" }))
      : fields.flatMap((field) => (results[field][0]?.locations ?? []).map((location) => ({ location, label: labels[field] })))
  const pageHighlights = highlights.filter(({ location }) => location.pageNumber === pageNumber)
  return (
    <section id="manuscript-review" aria-label="Manuscript parsing" className="w-full rounded-lg border p-4 sm:p-5">
      <h2 className="text-lg font-medium">Extract details from a manuscript</h2>
      <p className="mt-1 text-sm text-muted-foreground">Optional. Your PDF stays in this browser and is not uploaded. Review all suggestions before using them.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium" htmlFor="manuscript-pdf">Choose a PDF (up to 100 MB)</label>
        <input id="manuscript-pdf" type="file" accept=".pdf,application/pdf" onChange={chooseFile} className="max-w-full text-sm" />
        {file && <button type="button" className="underline" onClick={removeFile}>Remove PDF</button>}
      </div>
      {message && <p role="alert" className="mt-3 text-sm text-destructive">{message}</p>}
      {progress && <p role="status" className="mt-3 text-sm">{progress}</p>}
      {file && <div className="mt-4 grid gap-5 lg:grid-cols-2">
        <div ref={container} className="min-w-0 rounded border bg-muted/30 p-3">
          <div className="mb-3 flex items-center gap-3 text-sm">
            <button type="button" disabled={pageNumber <= 1} onClick={() => setPageNumber((n) => n - 1)} className="underline disabled:opacity-40">Previous page</button>
            <span>Page {pageNumber} of {pdf?.numPages ?? "…"}</span>
            <button type="button" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber((n) => n + 1)} className="underline disabled:opacity-40">Next page</button>
          </div>
          <div ref={pageBox} className="max-h-[70vh] overflow-auto" onMouseUp={captureSelection} onTouchEnd={captureSelection} onKeyUp={captureSelection}>
            <Document file={file} onLoadSuccess={loaded} onLoadError={() => { setProgress(""); setMessage("Unable to open this PDF. It may be encrypted or damaged.") }} onPassword={() => { sequence.current++; setFile(null); setProgress(""); setMessage("Password-protected PDFs cannot be parsed. Please use an unencrypted copy.") }} loading="Opening PDF…">
              <Page pageNumber={pageNumber} width={width} renderTextLayer renderAnnotationLayer={false}>
                {viewport && pageHighlights.map(({ location, label }, index) => {
                  const [x1, y1] = viewport.convertToViewportPoint(location.x, location.y)
                  const [x2, y2] = viewport.convertToViewportPoint(location.x + location.width, location.y + location.height)
                  return <span key={index} aria-hidden="true" className="pointer-events-none absolute z-10 bg-yellow-300/40 outline outline-1 outline-yellow-600" style={{ left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }}>{pageHighlights.findIndex((item) => item.label === label) === index && <span className="absolute bottom-full left-0 whitespace-nowrap bg-yellow-200 px-1 text-[10px] leading-3 text-black">{label}</span>}</span>
                })}
              </Page>
            </Document>
          </div>
          {selectedText && <div className="mt-3 space-y-2 text-sm"><p>Selected: {selectedText}</p><label>Assign selection to <select value={target} onChange={(event) => setTarget(event.target.value as ApplyField)} className="rounded border bg-background p-1">{fields.filter((field) => field !== "year").map((field) => <option key={field} value={field}>{labels[field]}</option>)}</select></label><button type="button" className="ml-2 underline" onClick={() => { if (onApply(target, selectedText) !== false) appliedSources.current = { ...appliedSources.current, [target]: { field: target, value: selectedText, score: 0, needsReview: true, locations: selectedLocations } } }}>Use selection</button></div>}
        </div>
        <div className="min-w-0 space-y-4">
          <p className="text-sm">Choose a suggestion to see its source, then use it in the publish form. Check that listed authors are contributors.</p>
          {fields.map((field) => <div key={field} className="border-b pb-3">
            <h3 className="font-medium">{labels[field]}</h3>
            {results[field].length === 0 ? <p className="text-sm text-muted-foreground">No suggestion found.</p> : <ul className="mt-1 space-y-2">{results[field].slice(0, expanded.includes(field) ? 20 : 5).map((candidate, index) => <li key={index} className="text-sm">
              <button type="button" onClick={() => showCandidate(candidate)} className="block max-w-full whitespace-pre-wrap wrap-break-word text-left underline">{candidate.value}</button>
              <span className="text-muted-foreground">{candidate.needsReview ? "Needs review" : "Suggested"} · Page {candidate.locations[0]?.pageNumber ?? "?"}</span>
              {(field !== "year" || candidate.monthYear) && <button type="button" className="ml-3 underline" onClick={() => { showCandidate(candidate); if (onApply(field, field === "year" ? candidate.monthYear! : candidate.value) !== false) appliedSources.current = { ...appliedSources.current, [field]: candidate } }}>Use {labels[field].toLowerCase()}</button>}
            </li>)}</ul>}
            {results[field].length > 5 && <button type="button" className="mt-2 text-sm underline" onClick={() => setExpanded((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field])}>{expanded.includes(field) ? "Show fewer suggestions" : "Show more suggestions"}</button>}
            {field === "year" && results.year.length > 0 && <p className="mt-1 text-xs text-muted-foreground">Dates with a month can be used in project credits. For a year alone, choose the month manually.</p>}
          </div>)}
        </div>
      </div>}
    </section>
  )
}
