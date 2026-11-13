export function pageSizeForWidth(width) {
  return width >= 1280 ? 12 : width >= 1024 ? 9 : width >= 640 ? 6 : 3
}

export function listingQueryForViewport(width, page, pageSize) {
  if (width === null) return null
  const viewportSize = pageSizeForWidth(width)
  return { page: viewportSize === pageSize ? page : 1, pageSize: viewportSize }
}
