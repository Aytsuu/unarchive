"use client"

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type PointerEvent } from "react"
import { Document, Page, pdfjs } from "react-pdf"
import type { PDFDocumentProxy, PDFPageProxy } from "pdfjs-dist"
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, File02Icon, FileUploadIcon } from "@hugeicons/core-free-icons"
import { HugeiconsIcon } from "@hugeicons/react"
import "react-pdf/dist/Page/TextLayer.css"
import { Button } from "@/components/ui/button"
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable"
import type { PanelImperativeHandle } from "react-resizable-panels"
import { parseManuscript, type ManuscriptPage, type ManuscriptCandidate, type ManuscriptField } from "@/lib/manuscript/parser"

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString()

type ApplyField = "title" | "description" | "abstract" | "institution" | "authors" | "year"
type Results = ReturnType<typeof parseManuscript>
type Location = ManuscriptCandidate["locations"][number]
const fields: ManuscriptField[] = ["title", "description", "abstract", "authors", "institution", "year"]
const labels: Record<ManuscriptField, string> = { title: "Title", description: "Short description", abstract: "Abstract", authors: "Authors", institution: "Institution", year: "Completion year" }
const empty = (): Results => ({ title: [], description: [], abstract: [], authors: [], institution: [], year: [] })
const previewRatio = 2 / 3

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

export function ManuscriptReview({ onApply, onSourcesReset, onResults, viewRequest, uploadVisible = true }: { onApply: (field: ApplyField, value: string, candidate: ManuscriptCandidate) => boolean | void; onSourcesReset?: () => void; onResults: (results: Results) => void; viewRequest?: { candidate: ManuscriptCandidate; sequence: number }; uploadVisible?: boolean }) {
  const [file, setFile] = useState<File | null>(null)
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
  const [pageNumber, setPageNumber] = useState(1)
  const [loadedPage, setLoadedPage] = useState<{ number: number; page: PDFPageProxy } | null>(null)
  const page = loadedPage?.number === pageNumber ? loadedPage.page : null
  const [results, setResults] = useState<Results>(empty)
  const [active, setActive] = useState<ManuscriptCandidate | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [cardOpen, setCardOpen] = useState(true)
  const [mobile, setMobile] = useState(false)
  const [selectedText, setSelectedText] = useState("")
  const [selectedLocations, setSelectedLocations] = useState<Location[]>([])
  const [target, setTarget] = useState<ApplyField>("title")
  const [message, setMessage] = useState("")
  const [progress, setProgress] = useState("")
  const [width, setWidth] = useState(600)
  const [panelWidth, setPanelWidth] = useState(440)
  const [minimumWidth, setMinimumWidth] = useState(320)
  const [maximumWidth, setMaximumWidth] = useState(580)
  const panelRef = useRef<PanelImperativeHandle>(null)
  const resizeStart = useRef<{ y: number; width: number } | null>(null)
  const sequence = useRef(0)
  const container = useRef<HTMLDivElement>(null)
  const pageBox = useRef<HTMLDivElement>(null)
  const uploadInput = useRef<HTMLInputElement>(null)
  const replaceInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const media = window.matchMedia("(max-width: 639px)")
    const update = () => { const maximum = Math.max(0, Math.min(document.documentElement.clientWidth - 32, (window.innerHeight - 32) * previewRatio)); setMobile(media.matches); setMaximumWidth(maximum); setMinimumWidth(Math.min(320, maximum)) }
    update()
    media.addEventListener("change", update)
    window.addEventListener("resize", update)
    return () => { media.removeEventListener("change", update); window.removeEventListener("resize", update) }
  }, [])

  function resizeFromTop(event: PointerEvent<HTMLButtonElement>) {
    if (!resizeStart.current) return
    panelRef.current?.resize(resizeStart.current.width + (resizeStart.current.y - event.clientY) * previewRatio)
  }

  useEffect(() => {
    if (!previewOpen || !mobile) return
    const previous = document.activeElement as HTMLElement | null
    const panel = container.current
    const controls = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([tabindex="-1"]), select, [tabindex]:not([tabindex="-1"])') ?? [])
    controls()[0]?.focus()
    function trap(event: KeyboardEvent) {
      if (event.key === "Escape") { setPreviewOpen(false); return }
      if (event.key !== "Tab") return
      const items = controls()
      if (!items.length) return
      const index = items.indexOf(document.activeElement as HTMLElement)
      if (event.shiftKey && index <= 0) { event.preventDefault(); items[items.length - 1].focus() }
      else if (!event.shiftKey && (index === -1 || index === items.length - 1)) { event.preventDefault(); items[0].focus() }
    }
    document.addEventListener("keydown", trap)
    return () => {
      document.removeEventListener("keydown", trap)
      requestAnimationFrame(() => {
        if (panel?.isConnected && panel.getAttribute("aria-hidden") === "false" && window.matchMedia("(max-width: 639px)").matches) return
        if (previous?.isConnected) previous.focus()
        else document.querySelector<HTMLElement>("#manuscript-review button, [data-manuscript-reopen]")?.focus()
      })
    }
  }, [previewOpen, mobile])

  useEffect(() => {
    const element = pageBox.current
    if (!element || !file) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.min(700, entry.contentRect.width))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [file, previewOpen])

  useEffect(() => {
    if (!pdf) return
    let cancelled = false
    pdf.getPage(pageNumber).then((next) => { if (!cancelled) setLoadedPage({ number: pageNumber, page: next }) }).catch(() => { if (!cancelled) setMessage("Unable to display this page.") })
    return () => { cancelled = true }
  }, [pdf, pageNumber])

  useEffect(() => () => { sequence.current++ }, [])

  useEffect(() => {
    if (!viewRequest) return
    const source = viewRequest.candidate
    let cancelled = false
    Promise.resolve().then(() => {
      if (cancelled) return
      setActive(source)
      setPreviewOpen(true)
      if (source.locations[0]) setPageNumber(source.locations[0].pageNumber)
    })
    return () => { cancelled = true }
  }, [viewRequest])

  useEffect(() => {
    const location = active?.locations.find((item) => item.pageNumber === pageNumber)
    const box = pageBox.current
    if (!location || !box || !page || !previewOpen) return
    const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width })
    const [, y] = viewport.convertToViewportPoint(location.x, location.y + location.height)
    const frame = requestAnimationFrame(() => box.scrollTo({ top: Math.max(0, y + 12 - box.clientHeight / 3), behavior: "smooth" }))
    return () => cancelAnimationFrame(frame)
  }, [active, page, pageNumber, previewOpen, width, viewRequest?.sequence])

  function scrollToActiveSource() {
    const location = active?.locations.find((item) => item.pageNumber === pageNumber)
    const box = pageBox.current
    if (!location || !box || !page || !previewOpen) return
    const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width })
    const [, y] = viewport.convertToViewportPoint(location.x, location.y + location.height)
    box.scrollTo({ top: Math.max(0, y + 12 - box.clientHeight / 3), behavior: "smooth" })
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0]
    event.target.value = ""
    if (!next) return
    const id = ++sequence.current
    onSourcesReset?.()
    onResults(empty())
    setFile(null); setPdf(null); setLoadedPage(null); setPageNumber(1); setResults(empty()); setActive(null); setPreviewOpen(false)
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
          if (number >= 10 && candidates.title.length && candidates.authors.length && candidates.abstract.length) break
        }
        // Let rendering and document replacement run between extraction steps.
        await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
        if (id !== sequence.current) return
      }
      if (id !== sequence.current) return
      const candidates = parseManuscript(pages)
      setResults(candidates)
      onResults(candidates)
      setPreviewOpen(true)
      setProgress("Parsing complete. Review every suggestion before using it.")
      if (!pages.some((item) => item.runs.length)) setMessage("No selectable text was found. This may be a scanned PDF; enter the details manually.")
    } catch {
      if (id === sequence.current) { setProgress(""); setMessage("Unable to extract text from this PDF. You can enter the details manually.") }
    }
  }

  function removeFile() {
    sequence.current++
    onSourcesReset?.()
    onResults(empty())
    setFile(null); setPdf(null); setLoadedPage(null); setResults(empty()); setActive(null); setPreviewOpen(false); setSelectedText(""); setSelectedLocations([]); setProgress(""); setMessage("")
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
  const highlights = fields.flatMap((field) => results[field].flatMap((candidate) => candidate.locations.map((location) => ({ location, label: labels[field], selected: candidate === active }))))
  if (selectedLocations.length && !active) highlights.push(...selectedLocations.map((location) => ({ location, label: "Selected text", selected: true })))
  const pageHighlights = highlights.filter(({ location }) => location.pageNumber === pageNumber)
  return (
    <>
    {!previewOpen && (uploadVisible || file || message || progress) && (cardOpen ? (
    <section id="manuscript-review" aria-label="Manuscript parsing" className="fixed right-4 bottom-4 z-60 max-h-[min(60vh,28rem)] w-[min(360px,calc(100vw-2rem))] overflow-auto rounded-2xl border bg-background p-5 shadow-xl sm:z-40">
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-xs font-medium text-muted-foreground">OPTIONAL</p><h2 className="mt-1 text-base font-semibold leading-snug">Add your manuscript</h2></div>
        <Button type="button" variant="ghost" size="sm" onClick={() => setCardOpen(false)} aria-label="Minimize manuscript upload" className="-mr-2 text-muted-foreground">Minimize</Button>
      </div>
      <p className="mt-2 text-sm leading-5 text-muted-foreground">Find suggestions for your project details from a PDF.</p>
      <input ref={uploadInput} id="manuscript-pdf" type="file" accept=".pdf,application/pdf" onChange={chooseFile} tabIndex={-1} aria-hidden="true" className="sr-only" />
      {file ? <div className="mt-4 rounded-xl border bg-muted/30 p-3">
        <div className="flex min-w-0 items-center gap-3"><span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-background text-primary"><HugeiconsIcon icon={File02Icon} size={20} aria-hidden="true" /></span><div className="min-w-0"><p className="truncate text-sm font-medium" title={file.name}>{file.name}</p><p className="mt-0.5 text-xs text-muted-foreground">PDF manuscript</p></div></div>
        <div className="mt-3 flex flex-wrap gap-2"><Button type="button" size="sm" onClick={() => setPreviewOpen(true)}>Open preview</Button><Button type="button" variant="ghost" size="sm" onClick={() => uploadInput.current?.click()}>Replace</Button><Button type="button" variant="ghost" size="sm" onClick={removeFile}>Remove</Button></div>
      </div> : <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 p-4 text-center">
        <span className="mx-auto flex size-10 items-center justify-center rounded-xl bg-background text-primary"><HugeiconsIcon icon={FileUploadIcon} size={20} aria-hidden="true" /></span>
        <p className="mt-2 text-sm font-medium">Choose a PDF to get started</p>
        <p className="mt-1 text-xs text-muted-foreground">Up to 100 MB · 300 pages</p>
        <Button type="button" size="sm" onClick={() => uploadInput.current?.click()} className="mt-3">Choose PDF</Button>
      </div>}
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Your PDF stays in this browser and is not uploaded.</p>
      {message && <p role="alert" className="mt-3 text-sm text-destructive">{message}</p>}
      {progress && <p role="status" className="mt-3 text-xs text-muted-foreground">{progress}</p>}
    </section>
    ) : <Button type="button" variant="secondary" data-manuscript-reopen onClick={() => setCardOpen(true)} className="fixed right-4 bottom-4 z-40 border bg-background shadow-lg"><HugeiconsIcon icon={File02Icon} size={16} aria-hidden="true" />Manuscript</Button>)}
      {file && <ResizablePanelGroup orientation="horizontal" disabled={!previewOpen || mobile} inert={!previewOpen} aria-hidden={!previewOpen} className={`pointer-events-none fixed inset-0 z-60 sm:inset-auto sm:right-4 sm:bottom-4 sm:z-40 sm:h-[calc(100dvh-2rem)] sm:w-full sm:max-w-[min(calc(100%-2rem+1px),calc(66.666667dvh-1.333333rem+1px))] ${previewOpen ? "" : "invisible"}`}>
        <ResizablePanel className="max-sm:hidden" minSize={0} />
        <ResizableHandle withHandle aria-label="Resize manuscript preview width" className={`hidden self-end bg-transparent after:w-4 sm:flex ${previewOpen ? "pointer-events-auto" : "pointer-events-none"}`} style={{ height: panelWidth / previewRatio }} />
        <ResizablePanel panelRef={panelRef} defaultSize={440} minSize={mobile ? 0 : minimumWidth} groupResizeBehavior="preserve-pixel-size" onResize={(size) => setPanelWidth(size.inPixels)} className="relative overflow-visible! max-sm:absolute max-sm:inset-0 max-sm:w-full">
        <AspectRatio ratio={previewRatio} className="absolute right-0 bottom-0 w-full max-sm:h-full max-sm:aspect-auto">
        {previewOpen && <button type="button" role="slider" aria-orientation="vertical" aria-valuemin={Math.round(minimumWidth / previewRatio)} aria-valuemax={Math.round(maximumWidth / previewRatio)} aria-valuenow={Math.round(panelWidth / previewRatio)} aria-valuetext={`${Math.round(panelWidth / previewRatio)} pixels high`} aria-label="Resize manuscript preview height" aria-describedby="preview-resize-help" onPointerDown={(event) => { resizeStart.current = { y: event.clientY, width: panelRef.current?.getSize().inPixels ?? panelWidth }; event.currentTarget.setPointerCapture(event.pointerId) }} onPointerMove={resizeFromTop} onPointerUp={() => { resizeStart.current = null }} onPointerCancel={() => { resizeStart.current = null }} onKeyDown={(event) => { if (["ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) { event.preventDefault(); panelRef.current?.resize(event.key === "Home" ? minimumWidth : event.key === "End" ? maximumWidth : panelWidth + (event.key === "ArrowUp" ? 24 : -24)) } }} className="pointer-events-auto absolute inset-x-4 top-0 z-20 hidden h-4 cursor-ns-resize touch-none items-center justify-center rounded-t-xl focus-visible:outline-2 focus-visible:outline-primary sm:flex"><span className="h-1 w-10 rounded-full bg-border" /></button>}
        <span id="preview-resize-help" className="sr-only">Drag the top or left edge to resize. Use the arrow keys when a resize handle is focused.</span>
        <div ref={container} role={mobile && previewOpen ? "dialog" : "region"} aria-modal={mobile && previewOpen ? true : undefined} aria-label="Manuscript preview" aria-hidden={!previewOpen} inert={!previewOpen} className={`absolute inset-0 flex min-w-0 flex-col overflow-hidden border bg-background shadow-xl sm:rounded-2xl ${previewOpen ? "pointer-events-auto" : "pointer-events-none opacity-0"}`}>
          <div className="flex shrink-0 items-start justify-between gap-3 px-4 pt-4 pb-3"><div className="min-w-0"><h2 className="text-base font-semibold">Manuscript preview</h2><p className="mt-1 truncate text-xs text-muted-foreground" title={file.name}>{file.name}</p></div><Button type="button" variant="ghost" size="icon-sm" onClick={() => setPreviewOpen(false)} aria-label="Close manuscript preview"><HugeiconsIcon icon={Cancel01Icon} size={18} aria-hidden="true" /></Button></div>
          <div className="flex shrink-0 items-center justify-between gap-2 border-t px-4 py-2"><div className="flex gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => replaceInput.current?.click()}>Replace</Button><input ref={replaceInput} id="manuscript-replace" type="file" accept=".pdf,application/pdf" onChange={chooseFile} tabIndex={-1} aria-hidden="true" className="sr-only" /><Button type="button" variant="ghost" size="sm" onClick={removeFile}>Remove</Button></div><span className="text-xs text-muted-foreground">PDF</span></div>
          {message && <p role="alert" className="px-4 pb-2 text-sm text-destructive">{message}</p>}
          {progress && <p role="status" className="sr-only">{progress}</p>}
          <div className="flex shrink-0 items-center justify-center gap-3 border-t px-4 py-2 text-sm">
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => setPageNumber((n) => n - 1)}><HugeiconsIcon icon={ArrowLeft01Icon} size={16} aria-hidden="true" /></Button>
            <span className="min-w-24 text-center text-xs font-medium tabular-nums text-muted-foreground">Page {pageNumber} of {pdf?.numPages ?? "…"}</span>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="Next page" disabled={!pdf || pageNumber >= pdf.numPages} onClick={() => setPageNumber((n) => n + 1)}><HugeiconsIcon icon={ArrowRight01Icon} size={16} aria-hidden="true" /></Button>
          </div>
          <div ref={pageBox} className="min-h-0 flex-1 overflow-auto bg-muted/60 p-3" onMouseUp={captureSelection} onTouchEnd={captureSelection} onKeyUp={captureSelection}>
            <Document file={file} onLoadSuccess={loaded} onLoadError={() => { setProgress(""); setMessage("Unable to open this PDF. It may be encrypted or damaged.") }} onPassword={() => { sequence.current++; setFile(null); setProgress(""); setMessage("Password-protected PDFs cannot be parsed. Please use an unencrypted copy.") }} loading="Opening PDF…">
              <Page pageNumber={pageNumber} width={width} renderTextLayer renderAnnotationLayer={false} onRenderSuccess={scrollToActiveSource}>
                {viewport && pageHighlights.map(({ location, label, selected }, index) => {
                  const [x1, y1] = viewport.convertToViewportPoint(location.x, location.y)
                  const [x2, y2] = viewport.convertToViewportPoint(location.x + location.width, location.y + location.height)
                  return <span key={index} aria-hidden="true" className={`pointer-events-none absolute outline outline-1 ${selected ? "z-20 bg-orange-400/60 outline-orange-700" : "z-10 bg-yellow-300/40 outline-yellow-600"}`} style={{ left: Math.min(x1, x2), top: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) }}>{selected && <span className="absolute bottom-full left-0 whitespace-nowrap bg-orange-200 px-1 text-[10px] leading-3 text-black">{label}</span>}</span>
                })}
              </Page>
            </Document>
          </div>
          {selectedText && <div className="max-h-40 space-y-2 overflow-auto border-t px-4 py-3 text-sm"><p className="line-clamp-2 text-muted-foreground">{selectedText}</p><div className="flex flex-wrap items-center gap-2"><label htmlFor="manuscript-target" className="text-xs font-medium">Assign to</label><select id="manuscript-target" value={target} onChange={(event) => setTarget(event.target.value as ApplyField)} className="h-8 rounded-lg border bg-background px-2 text-xs">{fields.filter((field) => field !== "year").map((field) => <option key={field} value={field}>{labels[field]}</option>)}</select><Button type="button" size="sm" onClick={() => { const candidate = { field: target, value: selectedText, score: 0, needsReview: true, locations: selectedLocations }; if (onApply(target, selectedText, candidate) !== false) { const next = { ...results, [target]: [candidate, ...results[target]] }; setResults(next); onResults(next); setActive(candidate) } }}>Use selection</Button></div></div>}
      </div></AspectRatio></ResizablePanel></ResizablePanelGroup>}
    </>
  )
}
