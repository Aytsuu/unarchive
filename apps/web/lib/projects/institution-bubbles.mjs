export function bubbleDiameter(count, maxCount, institutionCount = 1) {
  if (count <= 0 || maxCount <= 0) return 44
  const density = Math.min(1, 2.7 / Math.max(1, institutionCount))
  return Math.round(44 + 60 * density * Math.sqrt(Math.min(count / maxCount, 1)))
}

export function institutionShare(count, total) {
  return total > 0 ? Math.round(count / total * 100) : 0
}
