/** Find a directory name only when the manuscript identifies it unambiguously. */
export function matchInstitutionName(parsed: string, names: readonly string[]): string | null {
  const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}]+/gu, " ").replace(/\s+/g, " ").trim()
  const key = normalize(parsed)
  if (!key) return null

  const uniqueMatch = (predicate: (name: string) => boolean) => {
    const matches = [...new Set(names.filter(predicate))]
    return matches.length === 1 ? matches[0] : null
  }
  const exact = uniqueMatch((name) => normalize(name) === key)
  if (exact) return exact
  // A trailing "campus" is optional, but campus identifiers such as Main and
  // Danao remain part of the comparison to avoid merging different campuses.
  const withoutCampus = (value: string) => value.replace(/\s+campus$/, "")
  const campusKey = withoutCampus(key)
  return uniqueMatch((name) => withoutCampus(normalize(name)) === campusKey)
}
