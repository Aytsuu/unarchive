export function parseListingParams(params, authenticated) {
  const search = (params.get("q") ?? "").trim().slice(0, 100)
  const size = Number(params.get("size"))
  const pageSize = authenticated && [3, 6, 9, 12].includes(size) ? size : 3
  const rawPage = params.get("page") ?? "1"
  const parsedPage = /^\d+$/.test(rawPage) ? Number(rawPage) : 1
  const page = authenticated && Number.isSafeInteger(parsedPage) ? Math.max(1, parsedPage) : 1
  return { search, page, pageSize }
}
