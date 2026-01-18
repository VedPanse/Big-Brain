import { useEffect, useMemo, useRef, useState } from 'react'
import { Stage, Layer, Circle, Line, Text, Group } from 'react-konva'

const MAX_CONCEPTS = 40

const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value))

const blendHex = (hexA, hexB, amount) => {
  const a = hexA.replace('#', '')
  const b = hexB.replace('#', '')
  const toRgb = (hex) => ({
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
  })
  const rgbA = toRgb(a)
  const rgbB = toRgb(b)
  const mix = (start, end) => Math.round(start + (end - start) * amount)
  const toHex = (value) => value.toString(16).padStart(2, '0')
  return `#${toHex(mix(rgbA.r, rgbB.r))}${toHex(mix(rgbA.g, rgbB.g))}${toHex(mix(rgbA.b, rgbB.b))}`
}

const getConceptFill = (mastery) => {
  const low = '#F5D7CE'
  const high = '#D6F2E4'
  return blendHex(low, high, clamp(mastery))
}

const getGraphBounds = (nodes) => {
  const xs = nodes.map((node) => node.x)
  const ys = nodes.map((node) => node.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  return { minX, maxX, minY, maxY }
}

const buildLayout = (nodes, edges, width, height) => {
  const positions = new Map()
  const velocities = new Map()
  const padding = 80
  const areaWidth = Math.max(width - padding * 2, 200)
  const areaHeight = Math.max(height - padding * 2, 200)

  nodes.forEach((node, index) => {
    const angle = (index / nodes.length) * Math.PI * 2
    const radius = Math.min(areaWidth, areaHeight) * 0.35
    const x = width / 2 + Math.cos(angle) * radius + (Math.random() - 0.5) * 40
    const y = height / 2 + Math.sin(angle) * radius + (Math.random() - 0.5) * 40
    positions.set(node.id, { x, y })
    velocities.set(node.id, { x: 0, y: 0 })
  })

  const iterations = 140
  const repulsion = 5200
  const spring = 0.012
  const damping = 0.88

  for (let i = 0; i < iterations; i += 1) {
    for (let a = 0; a < nodes.length; a += 1) {
      const nodeA = nodes[a]
      for (let b = a + 1; b < nodes.length; b += 1) {
        const nodeB = nodes[b]
        const posA = positions.get(nodeA.id)
        const posB = positions.get(nodeB.id)
        const dx = posA.x - posB.x
        const dy = posA.y - posB.y
        const dist = Math.max(24, Math.hypot(dx, dy))
        const force = repulsion / (dist * dist)
        const offsetX = (dx / dist) * force
        const offsetY = (dy / dist) * force
        velocities.get(nodeA.id).x += offsetX
        velocities.get(nodeA.id).y += offsetY
        velocities.get(nodeB.id).x -= offsetX
        velocities.get(nodeB.id).y -= offsetY
      }
    }

    edges.forEach((edge) => {
      const source = positions.get(edge.source)
      const target = positions.get(edge.target)
      if (!source || !target) return
      const dx = target.x - source.x
      const dy = target.y - source.y
      const dist = Math.max(40, Math.hypot(dx, dy))
      const ideal = 140 - edge.weight * 40
      const force = (dist - ideal) * spring
      const offsetX = (dx / dist) * force
      const offsetY = (dy / dist) * force
      velocities.get(edge.source).x += offsetX
      velocities.get(edge.source).y += offsetY
      velocities.get(edge.target).x -= offsetX
      velocities.get(edge.target).y -= offsetY
    })

    nodes.forEach((node) => {
      const velocity = velocities.get(node.id)
      velocity.x *= damping
      velocity.y *= damping
      const pos = positions.get(node.id)
      pos.x = clamp(pos.x + velocity.x, padding, width - padding)
      pos.y = clamp(pos.y + velocity.y, padding, height - padding)
    })
  }

  return nodes.map((node) => {
    const pos = positions.get(node.id)
    return { ...node, x: pos.x, y: pos.y }
  })
}

export default function CourseConceptGraph() {
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const [rawNodes, setRawNodes] = useState([])
  const [rawEdges, setRawEdges] = useState([])
  const [layoutNodes, setLayoutNodes] = useState([])
  const [layoutEdges, setLayoutEdges] = useState([])
  const [dimensions, setDimensions] = useState({ width: 960, height: 520 })
  const [scale, setScale] = useState(1)
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  const [selected, setSelected] = useState(null)
  const [query, setQuery] = useState('')
  const [showAll, setShowAll] = useState(false)

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const response = await fetch('/api/graph/courses?userId=learner-1')
        if (!response.ok) return
        const data = await response.json()
        console.log('[GRAPH API RESPONSE]', data)
        console.log('[GRAPH API COUNTS]', {
          nodes: Array.isArray(data.nodes) ? data.nodes.length : 0,
          edges: Array.isArray(data.edges) ? data.edges.length : 0,
        })
        setRawNodes(Array.isArray(data.nodes) ? data.nodes : [])
        setRawEdges(Array.isArray(data.edges) ? data.edges : [])
      } catch {
        setRawNodes([])
        setRawEdges([])
      }
    }
    fetchGraph()
  }, [])

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      setDimensions({
        width: Math.max(560, Math.floor(width)),
        height: Math.max(420, Math.floor(height)),
      })
    })
    if (containerRef.current) {
      observer.observe(containerRef.current)
    }
    return () => observer.disconnect()
  }, [])

  const filteredGraph = useMemo(() => {
    const courses = rawNodes.filter((node) => node.type === 'course')
    const concepts = rawNodes.filter((node) => node.type === 'concept')
    if (showAll || concepts.length <= MAX_CONCEPTS) {
      return { nodes: rawNodes, edges: rawEdges }
    }
    const prioritized = [...concepts]
      .map((concept) => ({
        ...concept,
        priority: clamp(1 - concept.mastery) + clamp(concept.fragility) + clamp(concept.prereq_gap),
      }))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, MAX_CONCEPTS)
    const allowedConceptIds = new Set(prioritized.map((concept) => concept.id))
    const nodes = [...courses, ...prioritized]
    const edges = rawEdges.filter((edge) => allowedConceptIds.has(edge.target))
    return { nodes, edges }
  }, [rawNodes, rawEdges, showAll])

  useEffect(() => {
    if (!filteredGraph.nodes.length) return
    const layout = buildLayout(filteredGraph.nodes, filteredGraph.edges, dimensions.width, dimensions.height)
    console.log('[GRAPH NODES AFTER LAYOUT]', layout)
    setLayoutNodes(layout)
    setLayoutEdges(filteredGraph.edges)
  }, [filteredGraph, dimensions])

  const nodeMap = useMemo(() => {
    const map = new Map()
    layoutNodes.forEach((node) => map.set(node.id, node))
    return map
  }, [layoutNodes])

  const highlight = useMemo(() => {
    if (!selected) return null
    const neighbors = new Set()
    if (selected.type === 'course') {
      layoutEdges.forEach((edge) => {
        if (edge.source === selected.id) neighbors.add(edge.target)
      })
      return { nodes: new Set([selected.id, ...neighbors]) }
    }
    if (selected.type === 'concept') {
      layoutEdges.forEach((edge) => {
        if (edge.target === selected.id) neighbors.add(edge.source)
      })
      return { nodes: new Set([selected.id, ...neighbors]) }
    }
    return null
  }, [layoutEdges, selected])

  const handleWheel = (event) => {
    event.evt.preventDefault()
    const scaleBy = 1.08
    const stage = stageRef.current
    if (!stage) return
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    if (!pointer) return
    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }
    const nextScale = event.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy
    const clamped = clamp(nextScale, 0.6, 2.2)
    const newPos = {
      x: pointer.x - mousePointTo.x * clamped,
      y: pointer.y - mousePointTo.y * clamped,
    }
    setScale(clamped)
    setStagePos(newPos)
  }

  const focusNode = (node) => {
    if (!node) return
    const centerX = dimensions.width / 2
    const centerY = dimensions.height / 2
    setStagePos({
      x: centerX - node.x * scale,
      y: centerY - node.y * scale,
    })
    setSelected({ id: node.id, type: node.type })
  }

  const handleSearch = (event) => {
    event.preventDefault()
    const term = query.trim().toLowerCase()
    if (!term) return
    const match = layoutNodes.find((node) => node.label.toLowerCase().includes(term))
    if (match) {
      focusNode(match)
    }
  }

  const resetView = () => {
    setSelected(null)
    setScale(1)
    setStagePos({ x: 0, y: 0 })
  }

  const bounds = layoutNodes.length ? getGraphBounds(layoutNodes) : null
  const viewPadding = bounds ? Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) : 0

  const graphEmpty = rawNodes.length === 0

  return (
    <div className="rounded-[24px] border border-white/40 bg-white/70 p-6 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
      {graphEmpty && (
        <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-600">
          Graph empty — backend returned 0 nodes.
        </div>
      )}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Knowledge Graph
          </p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Course → Concept map</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search nodes"
              className="w-44 rounded-full border border-white/60 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm outline-none transition focus:border-slate-300"
            />
            <button
              type="submit"
              className="rounded-full border border-white/60 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm transition hover:text-slate-700"
            >
              Focus
            </button>
          </form>
          {rawNodes.filter((node) => node.type === 'concept').length > MAX_CONCEPTS && (
            <button
              type="button"
              onClick={() => setShowAll((prev) => !prev)}
              className="rounded-full border border-white/60 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm transition hover:text-slate-700"
            >
              {showAll ? 'Show top concepts' : 'Show all'}
            </button>
          )}
          <button
            type="button"
            onClick={resetView}
            className="rounded-full border border-white/60 bg-white/70 px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm transition hover:text-slate-700"
          >
            Reset view
          </button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-[520px] w-full overflow-hidden rounded-[20px] border border-white/40 bg-white/40 shadow-[inset_0_0_60px_rgba(148,163,184,0.15)]"
      >
        <Stage
          ref={stageRef}
          width={dimensions.width}
          height={dimensions.height}
          scaleX={scale}
          scaleY={scale}
          x={stagePos.x}
          y={stagePos.y}
          draggable
          onWheel={handleWheel}
          onDragEnd={(event) => setStagePos({ x: event.target.x(), y: event.target.y() })}
        >
          <Layer>
            {layoutEdges.map((edge) => {
              const source = nodeMap.get(edge.source)
              const target = nodeMap.get(edge.target)
              if (!source || !target) return null
              const active = highlight?.nodes?.has(edge.source) || highlight?.nodes?.has(edge.target)
              return (
                <Line
                  key={`${edge.source}-${edge.target}`}
                  points={[source.x, source.y, target.x, target.y]}
                  stroke="rgba(148, 163, 184, 0.55)"
                  strokeWidth={active ? 2 : 1}
                  opacity={active || !highlight ? 0.8 : 0.2}
                />
              )
            })}

            {layoutNodes.map((node) => {
              const isCourse = node.type === 'course'
              const size = isCourse ? 18 + node.importance * 12 : 8 + node.importance * 6
              const opacity = highlight && !highlight.nodes.has(node.id) ? 0.2 : 1
              const mastery = node.mastery ?? 0.4
              const fill = '#4169E1'
              const stroke = '#2B4FB3'
              const shadowBlur =
                !isCourse && node.confidence > 0.7 && node.mastery < 0.5 ? 12 : 0
              const shadowColor = shadowBlur ? 'rgba(244, 186, 104, 0.6)' : 'transparent'

              return (
                <Group
                  key={node.id}
                  x={node.x}
                  y={node.y}
                  opacity={opacity}
                  onMouseEnter={(event) => {
                    const pointer = event.target.getStage()?.getPointerPosition()
                    if (pointer) setHoverPos(pointer)
                    setHovered(node)
                  }}
                  onMouseMove={(event) => {
                    const pointer = event.target.getStage()?.getPointerPosition()
                    if (pointer) setHoverPos(pointer)
                  }}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => setSelected({ id: node.id, type: node.type })}
                >
                  <Circle
                    radius={size}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={isCourse ? 2 : 1.5}
                    shadowBlur={shadowBlur}
                    shadowColor={shadowColor}
                    shadowOpacity={0.6}
                  />
                  <Text
                    text={node.label}
                    fontSize={isCourse ? 12 : 10}
                    fontStyle={isCourse ? '600' : '500'}
                    fill="#475569"
                    width={isCourse ? 120 : 90}
                    offsetX={(isCourse ? 120 : 90) / 2}
                    offsetY={-size - 8}
                    align="center"
                  />
                </Group>
              )
            })}
          </Layer>
        </Stage>

        {hovered && (
          <div
            className="pointer-events-none absolute z-10 rounded-2xl border border-white/60 bg-white/80 px-3 py-2 text-xs text-slate-600 shadow-lg backdrop-blur-lg"
            style={{ left: hoverPos.x + 16, top: hoverPos.y + 12 }}
          >
            <p className="text-xs font-semibold text-slate-700">{hovered.label}</p>
            <p className="mt-1 text-[11px] uppercase tracking-[0.2em] text-slate-400">
              {hovered.type}
            </p>
            {hovered.type === 'concept' && (
              <div className="mt-1 text-[11px] text-slate-500">
                <p>Mastery: {Math.round((hovered.mastery ?? 0) * 100)}%</p>
                <p>Fragility: {Math.round((hovered.fragility ?? 0) * 100)}%</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 font-semibold">
          Course nodes: larger
        </span>
        <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 font-semibold">
          Concept fill = mastery
        </span>
        <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 font-semibold">
          Ring = fragile
        </span>
        <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 font-semibold">
          Glow = overconfidence
        </span>
        {bounds && viewPadding > 0 && (
          <span className="rounded-full border border-white/60 bg-white/70 px-3 py-1 font-semibold">
            {layoutNodes.length} nodes
          </span>
        )}
      </div>

    </div>
  )
}
