"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { LegalDocumentView } from "@/components/legal/legal-document"
import { legalDocumentByType } from "@/lib/legal/policy"

const linkClassName = "inline cursor-pointer border-0 bg-transparent p-0 font-medium text-[#155DFC] underline underline-offset-2"

export function LegalDialogLink({ document: type, children, className = "" }: { document: "terms" | "privacy"; children: string; className?: string }) {
  const document = legalDocumentByType(type)
  return (
    <Dialog>
      <DialogTrigger render={<button type="button" className={`${linkClassName} ${className}`.trim()} />}>
        {children}
      </DialogTrigger>
      <DialogContent className="max-h-[min(80vh,40rem)] w-full max-w-[calc(100%-2rem)] gap-4 overflow-hidden sm:max-w-2xl" aria-labelledby={`${type}-dialog-title`}>
        <DialogHeader>
          <DialogTitle id={`${type}-dialog-title`}>{document.title}</DialogTitle>
          <DialogDescription>
            Version {document.version}, effective {document.effectiveAt}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,32rem)] overflow-y-auto pr-1">
          <LegalDocumentView document={document} showTitle={false} />
        </div>
      </DialogContent>
    </Dialog>
  )
}
