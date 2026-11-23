import { createHash } from "node:crypto"
import { auth } from "@/lib/auth"
import { sameOrigin } from "@/lib/legal/origin"
import { claimReportAttempt } from "@/lib/legal/report-rate-limit"
import { createContentReport } from "@/lib/legal/report-store"
import { parseContentReport, ReportValidationError } from "@/lib/legal/reports"
import { db } from "@/lib/mongodb"

function failure(error: string, status: number, extra?: Record<string, string>) {
  return Response.json({ success: false, error }, { status, headers: { "Cache-Control": "no-store", ...extra } })
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure("Invalid request origin.", 403)
  const session = await auth.api.getSession({ headers: request.headers })
  const length = request.headers.get("content-length")
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > 20_000)) return failure("The request is too large.", 413)
  try {
    const key = session?.user.id ?? createHash("sha256").update(request.headers.get("cookie") ?? request.headers.get("user-agent") ?? "guest").digest("hex")
    const retryAfter = await claimReportAttempt(db, key)
    if (retryAfter) return failure("Too many requests. Please try again later.", 429, { "Retry-After": String(retryAfter) })
    const raw: unknown = await request.json()
    const report = parseContentReport(raw)
    if (!session && !report.contactEmail) return failure("Enter an email address so we can follow up.", 400)
    const created = await createContentReport(db, { ...report, ...(session ? { userId: session.user.id } : {}) })
    return Response.json({ success: true, data: created }, { status: 201, headers: { "Cache-Control": "no-store" } })
  } catch (error) {
    if (error instanceof ReportValidationError) return failure(error.message, 400)
    if (error instanceof SyntaxError) return failure("Invalid request details.", 400)
    console.error("Content report failed")
    return failure("Unable to send your request right now. Please try again.", 503)
  }
}
