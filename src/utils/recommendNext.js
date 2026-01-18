import { deriveNodeStates } from './deriveGraph'

const getUnmetPrereqCount = (node, nodeMap) =>
  node.prereqs.filter((id) => nodeMap[id]?.status !== 'mastered').length

export const recommendNext = (nodes) => {
  const { nodeMap, lockedMap } = deriveNodeStates(nodes)
  const available = nodes.filter((node) => !lockedMap.get(node.id))

  if (available.length) {
    return available.reduce((best, node) => {
      if (!best) return node
      if (node.mastery !== best.mastery) return node.mastery < best.mastery ? node : best
      return node.title.localeCompare(best.title) < 0 ? node : best
    }, null)
  }

  return nodes.reduce((best, node) => {
    if (!best) return node
    const nodeGap = getUnmetPrereqCount(node, nodeMap)
    const bestGap = getUnmetPrereqCount(best, nodeMap)
    if (nodeGap !== bestGap) return nodeGap < bestGap ? node : best
    return node.mastery < best.mastery ? node : best
  }, null)
}
