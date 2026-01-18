import { useEffect, useMemo, useRef, useState } from 'react'

const STAGE_WIDTH = 1400
const STAGE_HEIGHT = 900
const STORAGE_KEY = 'knowledge-graph-positions-v2'

const clamp = (value, min, max) => Math.min(Math.max(value, min), max)

const loadPositions = () => {
  if (typeof window === 'undefined') return {}
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    return {}
  }
}

const savePositions = (positions) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
  } catch (error) {
    // Ignore storage errors.
  }
}

const nodeKey = (node) => `${node.type}:${node.id}`

const hashString = (value) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(i)
    hash |= 0
  }
  return Math.abs(hash)
}

const layoutTopicPositions = (topics) => {
  const center = { x: STAGE_WIDTH / 2, y: STAGE_HEIGHT / 2 }
  const ringRadius = Math.min(STAGE_WIDTH, STAGE_HEIGHT) / 2 - 180
  const positions = {}

  topics
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .forEach((topic, index) => {
      const angle = (2 * Math.PI * index) / Math.max(topics.length, 1)
      positions[nodeKey(topic)] = {
        x: center.x + ringRadius * Math.cos(angle),
        y: center.y + ringRadius * Math.sin(angle),
      }
    })

  return positions
}

const layoutConceptPositions = (topics, concepts, topicPositions) => {
  const positions = {}
  const grouped = concepts.reduce((acc, concept) => {
    acc[concept.topicId] = acc[concept.topicId] || []
    acc[concept.topicId].push(concept)
    return acc
  }, {})

  topics.forEach((topic) => {
    const topicPos = topicPositions[nodeKey(topic)]
    if (!topicPos) return
    const list = grouped[topic.id] || []
    const radius = Math.max(36, 12 + list.length * 2.2)
    list.forEach((concept, index) => {
      const seed = hashString(concept.id)
      const angle = ((2 * Math.PI) / Math.max(list.length, 1)) * index + (seed % 360) * (Math.PI / 180)
      positions[nodeKey(concept)] = {
        x: topicPos.x + radius * Math.cos(angle),
        y: topicPos.y + radius * Math.sin(angle),
      }
    })
  })

  return positions
}

const getNodeRadius = (node) => {
  const base = node.type === 'topic' ? 10 : 5
  const exposureBoost = Math.min(node.exposures || 0, 12) * (node.type === 'topic' ? 0.5 : 0.25)
  const strengthBoost = (node.effectiveStrength || 0) * (node.type === 'topic' ? 12 : 6)
  return base + exposureBoost + strengthBoost
}

const getNodeStyle = (node) => {
  if (node.needsReview) {
    return {
      color: '#f59e0b',
      glow: node.type === 'topic' ? '0 0 18px rgba(245,158,11,0.35)' : '0 0 10px rgba(245,158,11,0.2)',
    }
  }
  if (node.effectiveStrength >= 0.7) {
    return {
      color: '#0ea5e9',
      glow: node.type === 'topic' ? '0 0 18px rgba(14,165,233,0.35)' : '0 0 10px rgba(14,165,233,0.2)',
    }
  }
  if (node.effectiveStrength >= 0.4) {
    return {
      color: '#38bdf8',
      glow: node.type === 'topic' ? '0 0 16px rgba(56,189,248,0.3)' : '0 0 9px rgba(56,189,248,0.2)',
    }
  }
  return {
    color: '#cbd5f5',
    glow: node.type === 'topic' ? '0 0 12px rgba(148,163,184,0.25)' : '0 0 6px rgba(148,163,184,0.18)',
  }
}

export default function GraphStage({
  topics,
  concepts,
  edges,
  selected,
  onSelect,
  searchTerm,
  showLabels,
  showNeedsReviewOnly,
  showConcepts,
}) {
  const stageRef = useRef(null)
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 })
  const [positions, setPositions] = useState(() => loadPositions())
  const [hovered, setHovered] = useState(null)
  const isPanning = useRef(false)
  const isDraggingNode = useRef(false)
  const dragNode = useRef(null)
  const lastPoint = useRef({ x: 0, y: 0 })

  const searchLower = searchTerm?.trim().toLowerCase() || ''

  const nodes = useMemo(() => {
    const topicNodes = topics.map((topic) => ({ ...topic, type: 'topic' }))
    const conceptNodes = showConcepts
      ? concepts.map((concept) => ({ ...concept, type: 'concept' }))
      : []
    return [...topicNodes, ...conceptNodes]
  }, [topics, concepts, showConcepts])

  const nodeMap = useMemo(
    () => Object.fromEntries(nodes.map((node) => [nodeKey(node), node])),
    [nodes],
  )

  useEffect(() => {
    if (!topics.length) return
    setPositions((prev) => {
      const next = { ...prev }
      const topicPositions = layoutTopicPositions(topics.map((topic) => ({ ...topic, type: 'topic' })))
      topics.forEach((topic) => {
        const key = nodeKey({ id: topic.id, type: 'topic' })
        if (!next[key]) next[key] = topicPositions[key]
      })
      const conceptPositions = layoutConceptPositions(
        topics.map((topic) => ({ ...topic, type: 'topic' })),
        concepts.map((concept) => ({ ...concept, type: 'concept' })),
        { ...next, ...topicPositions },
      )
      concepts.forEach((concept) => {
        const key = nodeKey({ id: concept.id, type: 'concept' })
        if (!next[key]) next[key] = conceptPositions[key]
      })
      savePositions(next)
      return next
    })
  }, [topics, concepts])

  useEffect(() => {
    if (!stageRef.current) return
    const { width, height } = stageRef.current.getBoundingClientRect()
    if (!width || !height) return
    const scale = clamp(Math.min(width / STAGE_WIDTH, height / STAGE_HEIGHT), 0.6, 1.4)
    const x = (width - STAGE_WIDTH * scale) / 2
    const y = (height - STAGE_HEIGHT * scale) / 2
    setView({ x, y, scale })
  }, [])

  const handleWheel = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const stage = stageRef.current
    if (!stage) return
    const { left, top } = stage.getBoundingClientRect()
    const cursorX = event.clientX - left
    const cursorY = event.clientY - top
    const delta = -event.deltaY * 0.0012
    const nextScale = clamp(view.scale + delta, 0.5, 2.0)
    const worldX = (cursorX - view.x) / view.scale
    const worldY = (cursorY - view.y) / view.scale
    const nextX = cursorX - worldX * nextScale
    const nextY = cursorY - worldY * nextScale
    setView({ x: nextX, y: nextY, scale: nextScale })
  }

  const handlePointerDown = (event) => {
    if (event.button !== 0) return
    const nodeTarget = event.target.closest('[data-node]')
    if (nodeTarget) {
      const nodeId = nodeTarget.dataset.nodeId
      const nodeType = nodeTarget.dataset.nodeType
      if (!nodeId || !nodeType) return
      isDraggingNode.current = true
      dragNode.current = { id: nodeId, type: nodeType }
      lastPoint.current = { x: event.clientX, y: event.clientY }
      return
    }
    isPanning.current = true
    lastPoint.current = { x: event.clientX, y: event.clientY }
  }

  const handlePointerMove = (event) => {
    const dx = event.clientX - lastPoint.current.x
    const dy = event.clientY - lastPoint.current.y
    lastPoint.current = { x: event.clientX, y: event.clientY }

    if (isDraggingNode.current && dragNode.current) {
      const { id, type } = dragNode.current
      const key = nodeKey({ id, type })
      setPositions((prev) => {
        const next = {
          ...prev,
          [key]: {
            x: (prev[key]?.x || 0) + dx / view.scale,
            y: (prev[key]?.y || 0) + dy / view.scale,
          },
        }
        if (type === 'topic') {
          concepts
            .filter((concept) => concept.topicId === id)
            .forEach((concept) => {
              const conceptKey = nodeKey({ id: concept.id, type: 'concept' })
              next[conceptKey] = {
                x: (prev[conceptKey]?.x || 0) + dx / view.scale,
                y: (prev[conceptKey]?.y || 0) + dy / view.scale,
              }
            })
        }
        savePositions(next)
        return next
      })
      return
    }

    if (isPanning.current) {
      setView((prev) => ({ ...prev, x: prev.x + dx, y: prev.y + dy }))
    }
  }

  const handlePointerUp = () => {
    isPanning.current = false
    isDraggingNode.current = false
    dragNode.current = null
  }

  const isMatch = (node) => !searchLower || node.label.toLowerCase().includes(searchLower)

  const shouldDimNode = (node) => {
    if (showNeedsReviewOnly && !node.needsReview) return true
    if (searchLower && !isMatch(node)) return true
    if (selected) {
      if (node.id === selected.id && node.type === selected.type) return false
      if (selected.type === 'topic') {
        if (node.type === 'concept' && node.topicId === selected.id) return false
      }
      if (selected.type === 'concept') {
        if (node.type === 'topic' && node.id === selected.topicId) return false
        if (node.type === 'concept' && node.topicId === selected.topicId) return false
      }
      const connected = edges.some(
        (edge) =>
          (edge.fromId === selected.id && edge.fromType === selected.type && edge.toId === node.id && edge.toType === node.type) ||
          (edge.toId === selected.id && edge.toType === selected.type && edge.fromId === node.id && edge.fromType === node.type),
      )
      return !connected
    }
    return false
  }

  const highlightedEdges = useMemo(() => {
    if (!selected) return new Set()
    const set = new Set()
    edges.forEach((edge) => {
      if (edge.fromId === selected.id && edge.fromType === selected.type) set.add(edge.id)
      if (edge.toId === selected.id && edge.toType === selected.type) set.add(edge.id)
      if (selected.type === 'topic' && edge.reason === 'belongs_to' && edge.fromId === selected.id) {
        set.add(edge.id)
      }
      if (selected.type === 'concept' && edge.reason === 'belongs_to') {
        if (edge.toId === selected.id || edge.fromId === selected.id) set.add(edge.id)
      }
    })
    return set
  }, [edges, selected])

  const visibleEdges = useMemo(() => {
    if (!showConcepts) {
      return edges.filter((edge) => edge.fromType === 'topic' && edge.toType === 'topic')
    }
    return edges
  }, [edges, showConcepts])

  return (
    <div
      ref={stageRef}
      className="relative h-[70vh] w-full cursor-grab overflow-hidden rounded-3xl border border-slate-200 bg-white active:cursor-grabbing"
      onWheelCapture={handleWheel}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
      style={{
        overscrollBehavior: 'contain',
        background:
          'radial-gradient(circle at 20% 10%, rgba(14,165,233,0.08), transparent 55%), radial-gradient(circle at 80% 90%, rgba(148,163,184,0.08), transparent 50%), #ffffff',
      }}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          width: STAGE_WIDTH,
          height: STAGE_HEIGHT,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
          transformOrigin: 'top left',
        }}
      >
        <svg width={STAGE_WIDTH} height={STAGE_HEIGHT} className="absolute left-0 top-0">
          {visibleEdges.map((edge) => {
            const from = positions[`${edge.fromType}:${edge.fromId}`]
            const to = positions[`${edge.toType}:${edge.toId}`]
            if (!from || !to) return null
            const isHighlighted = highlightedEdges.has(edge.id)
            const isBelongs = edge.reason === 'belongs_to'
            const opacity = isBelongs ? 0.2 : isHighlighted ? 0.75 : 0.3
            const stroke = isBelongs
              ? 'rgba(148,163,184,0.4)'
              : isHighlighted
                ? 'rgba(14,165,233,0.7)'
                : 'rgba(148,163,184,0.35)'
            return (
              <line
                key={edge.id}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={stroke}
                strokeWidth={1}
                opacity={opacity}
              />
            )
          })}
        </svg>

        {nodes.map((node) => {
          const position = positions[nodeKey(node)]
          if (!position) return null
          const radius = getNodeRadius(node)
          const style = getNodeStyle(node)
          const isSelected = selected && node.id === selected.id && node.type === selected.type
          const isHovered = hovered && node.id === hovered.id && node.type === hovered.type
          const revealLabel =
            showLabels ||
            isHovered ||
            isSelected ||
            (selected && selected.type === 'topic' && node.type === 'concept' && node.topicId === selected.id)
          const dimmed = shouldDimNode(node)
          return (
            <div
              key={nodeKey(node)}
              className="absolute"
              style={{
                left: position.x,
                top: position.y,
                transform: 'translate(-50%, -50%)',
                opacity: dimmed ? 0.2 : 1,
              }}
            >
              <button
                type="button"
                data-node-id={node.id}
                data-node-type={node.type}
                onClick={() => onSelect(node)}
                onMouseEnter={() => setHovered({ id: node.id, type: node.type })}
                onMouseLeave={() => setHovered(null)}
                className="relative flex items-center justify-center rounded-full"
                style={{
                  width: radius * 2,
                  height: radius * 2,
                  background: style.color,
                  boxShadow: style.glow,
                  border: isSelected ? '1px solid rgba(15,23,42,0.25)' : '1px solid transparent',
                }}
              />
              {revealLabel && (
                <div className="pointer-events-none absolute left-1/2 top-[18px] w-max -translate-x-1/2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-sm">
                  {node.label}
                </div>
              )}
              {isHovered && (
                <div className="pointer-events-none absolute left-1/2 top-[-46px] w-max -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] text-slate-600 shadow-[0_12px_24px_-18px_rgba(15,23,42,0.18)]">
                  <p className="text-slate-900">{node.label}</p>
                  <p className="mt-1 text-slate-500">
                    Strength {(node.effectiveStrength * 100).toFixed(0)}% · {node.exposures || 0} views
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <div className="pointer-events-none absolute left-4 top-4 rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-xs text-slate-500">
        Drag to pan · Scroll to zoom
      </div>
    </div>
  )
}
