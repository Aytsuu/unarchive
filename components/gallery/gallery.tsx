"use client"

import { useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { sections } from "@/components/gallery/examples"

const groups: Record<string, string[]> = {
  Actions: ["button", "button-group", "toggle", "toggle-group"],
  Forms: ["input", "input-group", "input-otp", "textarea", "label", "field", "checkbox", "radio-group", "switch", "slider", "select", "native-select", "combobox", "calendar", "questionnaire"],
  Navigation: ["breadcrumb", "tabs", "pagination", "navigation-menu", "menubar", "sidebar", "command"],
  Overlays: ["dialog", "alert-dialog", "drawer", "sheet", "popover", "tooltip", "hover-card", "dropdown-menu", "context-menu", "toast"],
  "Data display": ["accordion", "aspect-ratio", "avatar", "badge", "card", "carousel", "chart", "collapsible", "empty", "item", "kbd", "progress", "resizable", "scroll-area", "separator", "skeleton", "spinner", "table"],
  "Messages & feedback": ["alert", "attachment", "bubble", "code-block", "marker", "message", "message-scroller", "trace"],
}

function categoryFor(id: string) {
  return Object.entries(groups).find(([, ids]) => ids.includes(id))?.[0] ?? "Other"
}

export function Gallery() {
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All")
  const categories = useMemo(() => ["All", ...Array.from(new Set(sections.map((section) => categoryFor(section.id))))], [])
  const filtered = sections.filter((section) => {
    const matchesCategory = category === "All" || categoryFor(section.id) === category
    const matchesQuery = `${section.title} ${section.id} ${section.description ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())
    return matchesCategory && matchesQuery
  })

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between gap-4 px-5 sm:px-8">
          <a href="/components" className="flex items-center gap-3 font-semibold tracking-tight">
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">✳</span>
            <span>UI Library <span className="hidden font-normal text-muted-foreground sm:inline">/ Component gallery</span></span>
          </a>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1600px]">
        <aside className="sticky top-16 hidden h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r border-border px-5 py-8 lg:block">
          <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Browse library</p>
          <nav aria-label="Component categories" className="space-y-1">
            {categories.map((item) => (
              <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${category === item ? "bg-primary/10 font-medium text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                {item}<span className="text-xs tabular-nums opacity-70">{item === "All" ? sections.length : sections.filter((section) => categoryFor(section.id) === item).length}</span>
              </button>
            ))}
          </nav>
          <div className="mt-10 border-t border-border px-3 pt-5 text-xs leading-5 text-muted-foreground">A living reference for your components, variants, and states.</div>
        </aside>

        <main className="min-w-0 flex-1 px-5 pb-24 pt-10 sm:px-8 sm:pt-14 lg:px-12 xl:px-16">
          <div className="mb-10 flex flex-wrap items-end justify-between gap-6 border-b border-border pb-9">
            <div className="max-w-2xl">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.16em] text-primary">Design system / components</p>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Component gallery</h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">Explore the building blocks of your interface. Compare variants, try interactions, and see your changes as you make them.</p>
            </div>
            <span className="rounded-full border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground">{sections.length} components</span>
          </div>

          <div className="mb-8 space-y-4">
            <div className="max-w-md"><label htmlFor="component-search" className="sr-only">Search components</label><Input id="component-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components..." /></div>
            <nav aria-label="Component categories" className="flex flex-wrap gap-2 lg:hidden">
              {categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} aria-pressed={category === item} className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${category === item ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"}`}>{item}</button>)}
            </nav>
          </div>

          <div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-sm font-semibold">{category === "All" ? "All components" : category}</h2><p aria-live="polite" className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "component" : "components"}</p></div>
          {filtered.length === 0 ? <div className="rounded-xl border border-dashed border-border px-6 py-16 text-center"><p className="font-medium">No components found</p><p className="mt-2 text-sm text-muted-foreground">Try a different search or category.</p></div> : (
            <div className="grid grid-cols-1 gap-5 2xl:grid-cols-2">
              {filtered.map((section) => <section id={section.id} key={section.id} className="min-w-0 scroll-mt-24 overflow-hidden rounded-xl border border-border bg-card text-card-foreground"><div className="border-b border-border px-5 py-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold tracking-tight">{section.title}</h3><span className="text-[11px] font-medium text-muted-foreground">{categoryFor(section.id)}</span></div>{section.description && <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>}</div><div className="min-w-0 p-5 sm:p-6">{section.content}</div></section>)}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
