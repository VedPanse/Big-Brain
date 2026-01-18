import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Stage, Layer, Line, Rect, Text } from 'react-konva'

const TOOL_CONFIG = {
  pen: { stroke: '#1e293b', width: 3, opacity: 1, composite: 'source-over' },
  highlighter: { stroke: '#2f6bff', width: 12, opacity: 0.2, composite: 'source-over' },
  cross: { stroke: '#ef4444', width: 10, opacity: 0.8, composite: 'source-over', dash: [12, 8] },
  eraser: { stroke: '#ffffff', width: 20, opacity: 1, composite: 'destination-out' },
}

const buildLine = (tool, point, pressure = 0.5) => {
  const config = TOOL_CONFIG[tool] || TOOL_CONFIG.pen
  return {
    id: `line-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    tool,
    points: [point.x, point.y],
    stroke: config.stroke,
    width: config.width,
    opacity: config.opacity,
    composite: config.composite,
    dash: config.dash,
    createdAt: Date.now(),
    pressure,
  }
}

const normalizeBounds = (start, end, size) => {
  const x = Math.min(start.x, end.x)
  const y = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x)
  const height = Math.abs(end.y - start.y)

  return {
    x,
    y,
    width,
    height,
    normalized: {
      x: size.width ? x / size.width : 0,
      y: size.height ? y / size.height : 0,
      w: size.width ? width / size.width : 0,
      h: size.height ? height / size.height : 0,
    },
  }
}

const CanvasBoard = forwardRef(function CanvasBoard(
  {
    tool,
    confusionNote,
    onStrokeComplete,
    onInteraction,
    overlays = [],
    onPointerPause,
    onSizeChange,
    onStateChange,
    storageKey,
    resetSignal,
  },
  ref,
) {
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const [size, setSize] = useState({ width: 300, height: 300 })
  const [lines, setLines] = useState([])
  const linesRef = useRef([])
  const [texts, setTexts] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)
  const [confusions, setConfusions] = useState([])
  const [confusionDraft, setConfusionDraft] = useState(null)

  useEffect(() => {
    if (!storageKey) return
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey))
      if (stored?.lines) setLines(stored.lines)
      if (stored?.texts) setTexts(stored.texts)
      if (stored?.confusions) setConfusions(stored.confusions)
    } catch {
      // ignore storage errors
    }
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    localStorage.setItem(storageKey, JSON.stringify({ lines, texts, confusions }))
  }, [lines, texts, confusions, storageKey])

  useEffect(() => {
    if (!resetSignal) return
    setLines([])
    setTexts([])
    setConfusions([])
  }, [resetSignal])

  useEffect(() => {
    linesRef.current = lines
  }, [lines])

  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ width, height })
      onSizeChange?.({ width, height })
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    onStateChange?.({ lines, texts, confusions, size })
  }, [lines, texts, confusions, size, onStateChange])

  useImperativeHandle(ref, () => ({
    exportImage: (options = {}) => {
      if (!stageRef.current) return null
      return stageRef.current.toDataURL({
        mimeType: 'image/png',
        pixelRatio: options.pixelRatio || 1,
        quality: options.quality || 0.92,
      })
    },
    getState: () => ({ lines, texts, confusions, size }),
    stageRef,
  }))

  const handlePointerDown = (event) => {
    const stage = event.target.getStage()
    const point = stage.getPointerPosition()
    if (!point) return

    if (tool === 'confusion') {
      setConfusionDraft({ id: `conf-${Date.now()}`, start: point, end: point, createdAt: Date.now() })
      return
    }

    if (tool === 'text') {
      setTexts((prev) => [
        ...prev,
        { x: point.x, y: point.y, text: 'Note', id: `text-${prev.length}` },
      ])
      onStrokeComplete?.()
      onInteraction?.({ kind: 'text', text: 'Note', x: point.x, y: point.y, createdAt: Date.now() })
      return
    }

    const newLine = buildLine(tool, point, event.evt?.pressure ?? 0.5)
    setLines((prev) => [...prev, newLine])
    setIsDrawing(true)
  }

  const handlePointerMove = (event) => {
    if (confusionDraft) {
      const stage = event.target.getStage()
      const point = stage.getPointerPosition()
      if (!point) return
      setConfusionDraft((prev) => (prev ? { ...prev, end: point } : prev))
      return
    }

    if (!isDrawing) return
    const stage = event.target.getStage()
    const point = stage.getPointerPosition()
    if (!point) return

    setLines((prev) => {
      const updated = [...prev]
      const last = { ...updated[updated.length - 1] }
      last.points = last.points.concat([point.x, point.y])
      updated[updated.length - 1] = last
      return updated
    })
  }

  const handlePointerUp = () => {
    if (confusionDraft) {
      const bounds = normalizeBounds(confusionDraft.start, confusionDraft.end || confusionDraft.start, size)
      const region = {
        id: confusionDraft.id,
        ...bounds,
        createdAt: confusionDraft.createdAt,
        note: confusionNote || '',
      }
      setConfusions((prev) => [...prev, region])
      onInteraction?.({ kind: 'confusion', region })
      setConfusionDraft(null)
      return
    }

    if (!isDrawing) return
    setIsDrawing(false)
    const lastLine = linesRef.current[linesRef.current.length - 1]
    onStrokeComplete?.(lastLine)
    onInteraction?.({
      kind: lastLine?.tool === 'eraser' ? 'erase' : 'stroke',
      stroke: lastLine,
    })

    if (lastLine && onPointerPause) {
      const points = lastLine.points
      onPointerPause({ x: points[points.length - 2], y: points[points.length - 1] })
    }
  }

  return (
    <div ref={containerRef} className="h-full w-full">
      <Stage
        width={size.width}
        height={size.height}
        ref={stageRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <Layer>
          {lines.map((line, index) => (
            <Line
              key={`line-${index}`}
              points={line.points}
              stroke={line.stroke}
              strokeWidth={line.width}
              opacity={line.opacity}
              tension={0.4}
              lineCap="round"
              lineJoin="round"
              globalCompositeOperation={line.composite}
            />
          ))}
          {confusions.map((region) => (
            <Rect
              key={region.id}
              x={region.x}
              y={region.y}
              width={region.width}
              height={region.height}
              cornerRadius={12}
              stroke="#2563eb"
              strokeWidth={1}
              dash={[8, 6]}
              opacity={0.35}
              fill="#2563eb22"
            />
          ))}
          {confusionDraft ? (
            <Rect
              x={Math.min(confusionDraft.start.x, confusionDraft.end?.x || confusionDraft.start.x)}
              y={Math.min(confusionDraft.start.y, confusionDraft.end?.y || confusionDraft.start.y)}
              width={Math.abs((confusionDraft.end?.x || confusionDraft.start.x) - confusionDraft.start.x)}
              height={Math.abs((confusionDraft.end?.y || confusionDraft.start.y) - confusionDraft.start.y)}
              cornerRadius={12}
              stroke="#2563eb"
              strokeWidth={1}
              dash={[8, 6]}
              opacity={0.25}
              fill="#2563eb11"
            />
          ) : null}
          {overlays.map((line, index) => (
            <Line
              key={`overlay-${index}`}
              points={line.points}
              stroke={line.stroke}
              strokeWidth={line.width}
              opacity={line.opacity}
              dash={line.dash}
              tension={0.3}
              lineCap="round"
              lineJoin="round"
            />
          ))}
          {texts.map((text) => (
            <Text
              key={text.id}
              x={text.x}
              y={text.y}
              text={text.text}
              fontSize={16}
              fill="#1f2937"
            />
          ))}
        </Layer>
      </Stage>
    </div>
  )
})

export default CanvasBoard
