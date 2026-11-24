import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"
import { TERMS } from "@/lib/legal/policy"

export const metadata: Metadata = {
  title: "Terms & Conditions · Unarchive",
  description: "Rules and responsibilities for using Unarchive and publishing academic capstone projects.",
}

export default function TermsPage() {
  return <LegalPage document={TERMS} />
}
