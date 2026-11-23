export default function ReviewNotFound() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5">
      <h1 className="text-3xl font-medium tracking-tight">Submission not found</h1>
      <p className="mt-3 text-sm text-muted-foreground">This submission is no longer pending review.</p>
      <a href="/" className="mt-8 text-sm font-medium underline underline-offset-4">Back to moderation</a>
    </main>
  )
}
