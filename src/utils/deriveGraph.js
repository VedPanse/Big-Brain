const buildNodeMap = (nodes) => Object.fromEntries(nodes.map((node) => [node.id, node]))

const collectPrereqs = (nodeId, nodeMap, visited = new Set()) => {
  if (visited.has(nodeId)) return visited
  const node = nodeMap[nodeId]
  if (!node) return visited
  visited.add(nodeId)
  node.prereqs.forEach((pre) => collectPrereqs(pre, nodeMap, visited))
  return visited
}

export const deriveEdges = (nodes) => {
  const nodeMap = buildNodeMap(nodes)
  return nodes.flatMap((node) =>
    node.prereqs.map((pre) => ({
      from: pre,
      to: node.id,
      isCross: nodeMap[pre]?.islandId && nodeMap[pre]?.islandId !== node.islandId,
    })),
  )
}

export const deriveNodeStates = (nodes) => {
  const nodeMap = buildNodeMap(nodes)
  const lockedMap = new Map()

  nodes.forEach((node) => {
    const prereqLocked = node.prereqs.some((id) => nodeMap[id]?.status === 'locked')
    lockedMap.set(node.id, node.status === 'locked' || prereqLocked)
  })

  return { nodeMap, lockedMap }
}

export const deriveFilterSet = (nodes, status) => {
  if (!status || status === 'all') return new Set(nodes.map((node) => node.id))
  const nodeMap = buildNodeMap(nodes)
  const target = nodes.filter((node) => node.status === status).map((node) => node.id)
  const result = new Set()

  target.forEach((nodeId) => {
    result.add(nodeId)
    const prereqs = collectPrereqs(nodeId, nodeMap)
    prereqs.forEach((id) => result.add(id))
    nodes.forEach((node) => {
      if (node.prereqs.includes(nodeId)) result.add(node.id)
    })
  })

  return result
}

export const collectUnlocks = (nodeId, nodes) =>
  nodes.filter((node) => node.prereqs.includes(nodeId)).map((node) => node.id)

export const collectPrereqChain = (nodeId, nodes) => {
  const nodeMap = buildNodeMap(nodes)
  return collectPrereqs(nodeId, nodeMap)
}

export const buildNodeMapById = buildNodeMap
