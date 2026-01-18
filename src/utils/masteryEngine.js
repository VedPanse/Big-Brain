export function masteryEngine(masteryMap, nodeTitle) {
  const current = masteryMap[nodeTitle] ?? 0
  const next = Math.min(1, Number((current + 0.18).toFixed(2)))
  return {
    ...masteryMap,
    [nodeTitle]: next,
  }
}
