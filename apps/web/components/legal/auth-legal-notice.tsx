"use client"

import { LegalDialogLink } from "@/components/legal/legal-dialog"

export function AuthLegalNotice({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-sm font-medium leading-[normal] ${className}`.trim()}>
      By continuing, you agree to our
      <br />
      <LegalDialogLink document="terms">Terms of Service</LegalDialogLink>
      {" and "}
      <LegalDialogLink document="privacy">Privacy Policy</LegalDialogLink>
      .
    </p>
  )
}
