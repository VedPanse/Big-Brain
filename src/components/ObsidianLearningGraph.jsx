import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'

// Graph data comes from LearningContext (localStorage-backed). Mastery is read from masteryMap by title (or id fallback)
// and rendered as always-visible labels with a progress ring per node.

const theme = {
  background: '#F9FAFB',
  grid:
    'radial-gradient(circle at 20% 20%, rgba(0,0,0,0.015) 1px, transparent 0) 0 0 / 48px 48px, radial-gradient(circle at 80% 80%, rgba(0,0,0,0.01) 1px, transparent 0) 0 0 / 64px 64px',
  linkBase: 'rgba(0,0,0,0.25)',
  linkHighlight: 'rgba(0,0,0,0.35)',
  text: 'rgba(31, 41, 55, 0.9)',
  labelSubtle: 'rgba(55, 65, 81, 0.7)',
  masteryLow: '#E5E7EB',
  masteryMid: '#93C5FD',
  masteryHigh: '#2563EB',
}

const clamp01 = (n) => Math.min(1, Math.max(0, n ?? 0))

const hexToRgba = (hex, alpha) => {
  const bigint = parseInt(hex.replace('#', ''), 16)
  const r = (bigint >> 16) & 255
  const g = (bigint >> 8) & 255
  const b = bigint & 255
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function computeWeakestChain(nodes, masteryMap) {
  // Weakest path = highest total deficit (sum of 1 - mastery) from a root to any node, highlighted via node/edge sets.
  const nodeById = new Map(nodes.map((n) => [n.id, n]))
  const roots = nodes.filter((n) => !n.prerequisites?.length)
  const links = []
  nodes.forEach((n) => {
    n.prerequisites?.forEach((pre) => links.push({ source: pre, target: n.id }))
  })

  let weakest = { deficit: -Infinity, path: [] }

  const dfs = (id, path, deficit) => {
    const node = nodeById.get(id)
    if (!node) return
    const score = clamp01(masteryMap?.[node.title] ?? masteryMap?.[node.id] ?? 0)
    const newDeficit = deficit + (1 - score)
    const nextPath = [...path, id]
    const children = links.filter((l) => l.source === id).map((l) => l.target)
    if (!children.length && newDeficit > weakest.deficit) {
      weakest = { deficit: newDeficit, path: nextPath }
    }
    children.forEach((childId) => dfs(childId, nextPath, newDeficit))
  }

  roots.forEach((root) => dfs(root.id, [], 0))

  const nodeSet = new Set(weakest.path)
  const edgeSet = new Set()
  weakest.path.forEach((toId, idx) => {
    if (idx === 0) return
    const fromId = weakest.path[idx - 1]
    edgeSet.add(`${fromId}->${toId}`)
  })

  return { nodeSet, edgeSet }
}

function buildGraph(nodes, masteryMap) {
  const formattedNodes = nodes.map((n) => {
    const rawMastery = masteryMap?.[n.title] ?? masteryMap?.[n.id]
    if (rawMastery === undefined) {
      // eslint-disable-next-line no-console
      console.warn('Missing mastery for node', n.id || n.title)
    }
    return {
      ...n,
      mastery: rawMastery === undefined || rawMastery === null ? null : clamp01(rawMastery),
      id: n.id,
      label: n.title,
    }
  })

  const links = nodes.flatMap((n) =>
    (n.prerequisites || []).map((pre) => ({
      source: pre,
      target: n.id,
    })),
  )

  return { nodes: formattedNodes, links }
}

// Root cause note: crashes were caused by drawing with undefined node positions while the force sim
// was still initializing; guarded canvas drawing, deferred init until container has size,
// and memoized data to avoid re-instantiation.
export default function ObsidianLearningGraph({
  nodes,
  masteryMap,
  onSelect,
  forcePerformanceMode = false,
  nodeSizeScale = 1,
  fontScale = 1,
  showPerfToggle = true,
}) {
  const fgRef = useRef(null)
  const containerRef = useRef(null)
  const [search, setSearch] = useState('')
  const [focusedId, setFocusedId] = useState(null)
  const [hoveredId, setHoveredId] = useState(null)
  const [pinnedIds, setPinnedIds] = useState(() => new Set())
  const [status, setStatus] = useState('Loading data…')
  const [shouldInit, setShouldInit] = useState(false)
  const [perfMode, setPerfMode] = useState(forcePerformanceMode)
  const [showPerfPrompt, setShowPerfPrompt] = useState(false)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const mountLogged = useRef(false)
  const forceLogged = useRef(false)

  useEffect(() => {
    setPerfMode(forcePerformanceMode)
  }, [forcePerformanceMode])

  useEffect(() => {
    if (!mountLogged.current) {
      mountLogged.current = true
      console.time('graph-initial-render')
      console.timeEnd('graph-initial-render')
    }
  }, [])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (!rect) return
      if (rect.width !== size.width || rect.height !== size.height) {
        setSize({ width: rect.width, height: rect.height })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [size.width, size.height])

  useEffect(() => {
    const idle = window.requestIdleCallback || ((cb) => setTimeout(cb, 50))
    if (size.width > 0 && size.height > 0 && !shouldInit) {
      setStatus('Computing weakest chain…')
      idle(() => setShouldInit(true))
    }
  }, [shouldInit, size.height, size.width])

  useEffect(() => {
    if (shouldInit) setStatus('Rendering graph…')
  }, [shouldInit])

  useEffect(() => {
    const timer = setTimeout(() => setShowPerfPrompt(true), 1500)
    return () => clearTimeout(timer)
  }, [])

  const graph = useMemo(() => {
    console.time('graph-data-transform')
    const built = buildGraph(nodes, masteryMap)
    console.timeEnd('graph-data-transform')
    const validIds = new Set(built.nodes.map((n) => n.id))
    const filteredLinks = built.links.filter((l) => validIds.has(l.source) && validIds.has(l.target))
    if (filteredLinks.length !== built.links.length) {
      // eslint-disable-next-line no-console
      console.warn('Filtered invalid links', built.links.length - filteredLinks.length)
    }
    return { nodes: built.nodes, links: filteredLinks }
  }, [nodes, masteryMap])

  const weakest = useMemo(() => computeWeakestChain(nodes, masteryMap), [nodes, masteryMap])

  const adjacency = useMemo(() => {
    const map = new Map()
    nodes.forEach((n) => map.set(n.id, new Set()))
    nodes.forEach((n) => {
      n.prerequisites?.forEach((pre) => {
        map.get(n.id)?.add(pre) // prerequisites
        map.get(pre)?.add(n.id) // dependents
      })
    })
    return map
  }, [nodes])

  const focusNeighborhood = useMemo(() => {
    if (!focusedId) return null
    const neighborIds = new Set([focusedId])
    adjacency.get(focusedId)?.forEach((id) => neighborIds.add(id))
    return neighborIds
  }, [adjacency, focusedId])

  const focusNodeBySearch = useCallback(
    (term) => {
      const query = term.trim().toLowerCase()
      if (!query) return
      const match = graph.nodes.find((n) => n.title.toLowerCase().includes(query))
      if (match) {
        setFocusedId(match.id)
        fgRef.current?.centerAt(match.x || 0, match.y || 0, 400)
        fgRef.current?.zoom(1.6, 500)
      }
    },
    [graph.nodes],
  )

  const resetView = useCallback(() => {
    setFocusedId(null)
    setSearch('')
    fgRef.current?.zoomToFit(600, 40)
  }, [])

  useEffect(() => {
    if (!shouldInit || !fgRef.current) return
    // Physics tuning lives here: adjust repulsion (charge) and link distance to change spacing/settle speed.
    const charge = perfMode ? -110 : -150
    const linkDistance = perfMode ? 70 : 85
    fgRef.current.d3Force('charge').strength(charge)
    fgRef.current.d3Force('link').distance(linkDistance)
    if (!forceLogged.current) {
      forceLogged.current = true
      console.time('graph-force-init')
      setTimeout(() => console.timeEnd('graph-force-init'), 0)
    }
  }, [perfMode, shouldInit])

  const handleNodeClick = (node) => {
    setFocusedId(node.id)
    setPinnedIds((prev) => {
      const next = new Set(prev)
      if (next.has(node.id)) next.delete(node.id)
      else next.add(node.id)
      return next
    })
    onSelect?.(node)
  }

  const matchesSearch = (nodeLike) => {
    const query = search.trim().toLowerCase()
    if (!query) return false
    const node = typeof nodeLike === 'string' ? graph.nodes.find((n) => n.id === nodeLike) : nodeLike
    return node?.title?.toLowerCase().includes(query)
  }

  const nodeCanvasObject = (node, ctx, scale) => {
    if (!ctx || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return
    const isWeakest = weakest.nodeSet.has(node.id)
    const isFocused = focusNeighborhood?.has(node.id)
    const isPinned = pinnedIds.has(node.id)
    const isHovered = hoveredId === node.id
    const dimBySearch = search.trim() && !matchesSearch(node) && !isFocused
    const dimByFocus = focusNeighborhood && !isFocused

    const baseSize = (4 + (node.mastery ?? 0) * 4) * nodeSizeScale
    const size =
      baseSize + (isPinned ? 2.5 : 0) * nodeSizeScale + (isHovered ? 1.5 : 0) * nodeSizeScale

    const mastery = node.mastery
    const fillColor =
      mastery === null
        ? theme.masteryLow
        : mastery < 0.3
          ? theme.masteryLow
          : mastery < 0.7
            ? theme.masteryMid
            : theme.masteryHigh

    ctx.beginPath()
    ctx.fillStyle = fillColor
    ctx.arc(node.x, node.y, size, 0, 2 * Math.PI)
    ctx.fill()

    // Progress ring (always visible, uses mastery from LearningContext)
    const pct = mastery === null ? 0 : mastery
    ctx.beginPath()
    const ringColor =
      isWeakest || isFocused
        ? theme.linkHighlight
        : hexToRgba('#1f2937', dimBySearch || dimByFocus ? 0.25 : 0.45)
    ctx.strokeStyle = ringColor
    ctx.lineWidth = 3 / Math.max(1, scale)
    ctx.arc(node.x, node.y, size + 4, -Math.PI / 2, -Math.PI / 2 + pct * 2 * Math.PI)
    ctx.stroke()

    // Labels always visible
    const fontSize = Math.max(10 * fontScale, (12 * fontScale) / Math.max(1, scale))
    ctx.font = `${fontSize}px "Inter", system-ui, sans-serif`
    ctx.fillStyle = theme.text
    ctx.fillText(node.title, node.x + size + 6, node.y - 2)

    ctx.fillStyle = theme.labelSubtle
    const percentText = mastery === null ? '—' : `${Math.round(pct * 100)}%`
    ctx.fillText(percentText, node.x + size + 6, node.y + fontSize + 4)
  }

  const nodePointerAreaPaint = (node, color, ctx) => {
    if (!ctx || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.arc(node.x, node.y, 10 * nodeSizeScale, 0, 2 * Math.PI)
    ctx.fill()
  }

  const linkColor = (link) => {
    const key = `${link.source.id || link.source}->${link.target.id || link.target}`
    const inWeakest = weakest.edgeSet.has(key)
    const connectsFocus =
      focusNeighborhood &&
      focusNeighborhood.has(link.source.id || link.source) &&
      focusNeighborhood.has(link.target.id || link.target)
    const dim =
      (search.trim() && !matchesSearch(link.source) && !matchesSearch(link.target) && !connectsFocus) ||
      (focusNeighborhood && !connectsFocus)
    if (inWeakest || connectsFocus) return theme.linkHighlight
    if (dim) return 'rgba(0,0,0,0.08)'
    return theme.linkBase
  }

  const autoPerf = graph.nodes.length > 300 || graph.links.length > 600
  const effectivePerf = perfMode || autoPerf

  const statusText = (() => {
    if (!shouldInit) return status
    if (showPerfPrompt && !effectivePerf) return 'Rendering graph… (consider Performance Mode)'
    return 'Rendering graph…'
  })()

  const isDev = import.meta.env?.MODE !== 'production'

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_10px_40px_rgba(0,0,0,0.08)]"
      style={{
        backgroundColor: theme.background,
        backgroundImage: theme.grid,
      }}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(37,99,235,0.06),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(147,197,253,0.08),transparent_30%)]" />
      <div className="absolute left-4 top-4 z-10 flex w-[260px] items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3 py-2 text-sm text-slate-700 backdrop-blur">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && focusNodeBySearch(search)}
          placeholder="Search concepts…"
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        <button
          type="button"
          onClick={() => focusNodeBySearch(search)}
          className="rounded-full bg-slate-900 px-3 py-1 text-xs font-semibold text-white transition hover:bg-slate-800"
        >
          Focus
        </button>
      </div>

      <div className="absolute right-4 top-4 z-10 flex items-center gap-2">
        <button
          type="button"
          onClick={resetView}
          className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Reset view
        </button>
      </div>

      {showPerfToggle && showPerfPrompt && !effectivePerf && (
        <button
          type="button"
          onClick={() => setPerfMode(true)}
          className="absolute bottom-4 left-4 z-10 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Load in Performance Mode
        </button>
      )}

      {isDev && (
        <div className="absolute bottom-4 right-4 z-10 rounded-lg border border-slate-200 bg-white/90 px-3 py-2 text-[11px] font-semibold text-slate-700 backdrop-blur">
          <div>nodes: {graph.nodes.length}</div>
          <div>links: {graph.links.length}</div>
          <div>
            size: {Math.round(size.width)}x{Math.round(size.height)}
          </div>
          <div>perf: {effectivePerf ? 'on' : 'off'}</div>
        </div>
      )}

      {!shouldInit || size.width === 0 || size.height === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
          <p className="text-sm font-semibold text-slate-700">Building your map…</p>
          <p className="text-xs text-slate-500">{statusText}</p>
        </div>
      ) : graph.nodes.length === 0 ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
          <p className="text-sm font-semibold text-slate-700">No concepts yet.</p>
          <p className="text-xs text-slate-500">Add topics to see them here.</p>
        </div>
      ) : (
        <ForceGraph2D
          ref={fgRef}
          graphData={graph}
          backgroundColor="rgba(0,0,0,0)"
          nodeLabel={(node) =>
            `${node.title} · ${node.mastery === null || node.mastery === undefined ? '—' : `${Math.round(node.mastery * 100)}%`}`
          }
          nodeRelSize={5 * nodeSizeScale}
          width={size.width}
          height={size.height}
          enableZoomInteraction
          enablePanInteraction
          cooldownTicks={effectivePerf ? 60 : 90}
          cooldownTime={effectivePerf ? 1500 : 2200}
          linkColor={linkColor}
          linkWidth={(link) =>
            weakest.edgeSet.has(`${link.source.id || link.source}->${link.target.id || link.target}`) ? 1.1 : 0.7
          }
          linkDirectionalParticles={0}
          nodeCanvasObject={nodeCanvasObject}
          nodePointerAreaPaint={nodePointerAreaPaint}
          onNodeClick={handleNodeClick}
          onNodeHover={(node) => setHoveredId(node?.id || null)}
          onBackgroundClick={() => setFocusedId(null)}
          onEngineStop={() => setStatus('Ready')}
        />
      )}
    </div>
  )
}
