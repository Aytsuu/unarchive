import type { Metadata } from "next"
import { LegalPage } from "@/components/legal/legal-page"
import { PRIVACY } from "@/lib/legal/policy"

export const metadata: Metadata = {
  title: "Privacy Policy · Unarchive",
  description: "How Unarchive collects, uses, and protects personal information.",
}

export default function PrivacyPage() {
  return <LegalPage document={PRIVACY} />
}
