import { connection } from "next/server"
import { Suspense } from "react"
import { listPendingSubmissions, promoteApprovedSubmissions } from "@unarchive/domain/submissions"
import { requireModerator } from "../lib/gate"
import { refreshPublicList } from "../lib/refresh-public-list"
import { db } from "@unarchive/server/mongodb"

function formatSubmitted(value: string) {
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
}

async function Queue() {
  await connection()
  const user = await requireModerator()
  const promoted = await promoteApprovedSubmissions(db)
  if (promoted > 0) await refreshPublicList()
  const submissions = await listPendingSubmissions(db)
  const home = process.env.WEB_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000"
  return (
    <div className="min-h-dvh">
      <header className="flex items-center justify-between gap-4 px-5 pt-9 sm:px-11">
        <a href={home} className="text-xl font-medium">Unarchive</a>
        <p className="truncate text-sm text-muted-foreground">{user.name || user.email}</p>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 pt-12 pb-16">
        <h1 id="moderation-heading" className="text-3xl font-medium tracking-tight">Moderation</h1>
        <p className="mt-2 text-sm text-muted-foreground">Projects submitted for publication. Pending submissions stay off the public site until a moderator approves them.</p>
        <section aria-labelledby="moderation-heading" className="mt-8">
          <h2 className="text-base font-medium">Pending submissions</h2>
          {submissions.length === 0 ? <p className="py-10 text-sm text-muted-foreground">No submissions are waiting for review.</p> : (
            <ul className="mt-4 flex flex-col gap-3">
              {submissions.map((submission) => (
                <li key={submission.id}>
                  <a href={`/reviews/${submission.id}`} className="block rounded-[20px] border border-border p-5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <div className="flex items-start justify-between gap-4">
                      <p className="text-sm">{submission.ownerName}</p>
                      <p className="shrink-0 rounded-4xl bg-secondary px-2.5 py-1 text-xs font-medium">Pending</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{submission.institution || "Institution not listed"}</p>
                    <h3 className="mt-3 text-[22px] leading-tight font-medium">{submission.title}</h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-snug text-muted-foreground">{submission.description}</p>
                    <p className="mt-4 text-xs text-muted-foreground">Submitted {formatSubmitted(submission.submittedAt)}</p>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  )
}

export default function ModerationQueuePage() {
  return <Suspense fallback={<main className="min-h-dvh bg-background" />}><Queue /></Suspense>
}
