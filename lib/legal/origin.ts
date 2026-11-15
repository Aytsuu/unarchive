export function requestOrigin(request: Request) {
  try { return new URL(process.env.BETTER_AUTH_URL ?? request.url).origin } catch { return null }
}

export function sameOrigin(request: Request) {
  const origin = requestOrigin(request)
  return origin !== null && request.headers.get("origin") === origin
}
