const NODE_WIDTH = 176
const NODE_HEIGHT = 46

const clamp = (value, min) => (value < min ? min : value)

const computeEdgePoints = (from, to) => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const distance = Math.hypot(dx, dy) || 1
  const ux = dx / distance
  const uy = dy / distance
  const offset = clamp(Math.min(NODE_WIDTH / 2 - 8, distance / 2 - 10), 8)

  return {
    x1: from.x + ux * offset,
    y1: from.y + uy * offset,
    x2: to.x - ux * offset,
    y2: to.y - uy * offset,
  }
}

export default function EdgesLayer({ edges, nodeMap, highlightedEdges, dimmedEdges }) {
  return (
    <>
      {edges.map((edge) => {
        const from = nodeMap[edge.from]
        const to = nodeMap[edge.to]
        if (!from || !to) return null
        const { x1, y1, x2, y2 } = computeEdgePoints(from, to)
        const edgeKey = `${edge.from}-${edge.to}`
        const isHighlighted = highlightedEdges?.has(edgeKey)
        const isDimmed = !isHighlighted && dimmedEdges?.has(edgeKey)
        const stroke = isHighlighted ? 'rgba(59,130,246,0.55)' : 'rgba(17,24,39,0.14)'
        const opacity = isDimmed ? 0.2 : 1
        const dash = edge.isCross ? '4 6' : undefined

        return (
          <line
            key={edgeKey}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={stroke}
            strokeWidth={1}
            strokeDasharray={dash}
            opacity={opacity}
          />
        )
      })}
    </>
  )
}
