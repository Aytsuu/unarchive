import { isIP } from "node:net"

/** Accept only one address from an explicitly trusted proxy header. */
export function normalizeViewIp(value: string | null): string | null {
  const ip = value?.trim()
  if (!ip || !isIP(ip)) return null
  if (isIP(ip) === 4) return ip
  // URL parsing canonicalizes equivalent IPv6 spellings and embedded IPv4.
  let normalized: string
  try { normalized = new URL(`http://[${ip}]/`).hostname.slice(1, -1).toLowerCase() } catch { return null }
  const mapped = /^::ffff:([\da-f]{1,4}):([\da-f]{1,4})$/.exec(normalized)
  if (mapped) {
    const high = parseInt(mapped[1], 16)
    const low = parseInt(mapped[2], 16)
    return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`
  }
  return normalized
}

export function viewIpFromHeaders(headers: Headers, configuredHeader: string | undefined, environment: string | undefined): string | null {
  const name = configuredHeader?.trim() || (environment === "development" ? "x-forwarded-for" : "")
  if (!name || !/^[!#$%&'*+.^_`|~\da-z-]+$/i.test(name)) return null
  return normalizeViewIp(headers.get(name))
}
