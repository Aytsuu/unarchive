function loopbackOrigin(value: string | null): string | null {
  if (!value) return null
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1") return url.origin
  } catch { return null }
  return null
}

export function requestOrigin(request: Request) {
  if (process.env.NODE_ENV !== "production") {
    const fromHeader = loopbackOrigin(request.headers.get("origin"))
    if (fromHeader) return fromHeader
    const fromRequest = loopbackOrigin(request.url)
    if (fromRequest) return fromRequest
  }
  try { return new URL(process.env.BETTER_AUTH_URL ?? request.url).origin } catch { return null }
}

export function sameOrigin(request: Request) {
  const origin = requestOrigin(request)
  return origin !== null && request.headers.get("origin") === origin
}
