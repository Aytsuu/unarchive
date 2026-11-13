export function canonicalProjectUrl(baseUrl: string, projectId: string, version?: number): string {
  if (!/^[a-f\d]{24}$/i.test(projectId)) return ""
  if (version !== undefined && (!Number.isSafeInteger(version) || version < 1)) return ""
  try {
    const base = new URL(baseUrl)
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) return ""
    return new URL(`/projects/${projectId.toLowerCase()}${version === undefined ? "" : `/versions/${version}`}`, base.origin).href
  } catch {
    return ""
  }
}
