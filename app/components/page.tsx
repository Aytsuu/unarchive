import type { Metadata } from "next"
import { Suspense } from "react"
import { Gallery } from "@/components/gallery/gallery"

export const metadata: Metadata = {
  title: "Component gallery",
  description: "Explore the components and variants in the UI library.",
}

export default function ComponentsPage() {
  return <Suspense fallback={<main className="p-8">Loading component gallery…</main>}><Gallery /></Suspense>
}
