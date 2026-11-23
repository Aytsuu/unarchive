export default function Forbidden() {
  const home = process.env.WEB_APP_URL || process.env.BETTER_AUTH_URL || "http://localhost:3000"
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5">
      <p className="text-sm text-muted-foreground">Unarchive</p>
      <h1 className="mt-3 text-3xl font-medium tracking-tight">Moderation is unavailable</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">This account does not have moderator permission. Ask an administrator to grant access, then open the queue again.</p>
      <a href={home} className="mt-8 inline-flex h-9 w-fit items-center rounded-4xl bg-primary px-3 text-sm font-medium text-primary-foreground">Back to Unarchive</a>
    </main>
  )
}
