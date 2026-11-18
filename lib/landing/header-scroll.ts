export function isLandingHeaderCompact(scrollTop: number) {
  return scrollTop > 0
}

export function isLandingHeaderCompactFromSentinel(isIntersecting: boolean) {
  return !isIntersecting
}
