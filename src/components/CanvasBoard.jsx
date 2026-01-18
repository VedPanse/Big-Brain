import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Line, Text } from 'react-konva'

const TOOL_CONFIG = {
  pen: { stroke: '#1e293b', width: 3, opacity: 1, composite: 'source-over' },
  highlighter: { stroke: '#2f6bff', width: 12, opacity: 0.2, composite: 'source-over' },
  eraser: { stroke: '#ffffff', width: 20, opacity: 1, composite: 'destination-out' },
}

const makeId = (prefix) => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export default function CanvasBoard({
  tool,
  onChange,
  onStrokeComplete,
  overlays = [],
  overlayTexts = [],
  onPointerPause,
  onSizeChange,
  onImageExport,
  exportSignal,
  storageKey,
  resetSignal,
}) {
  const containerRef = useRef(null)
  const stageRef = useRef(null)
  const [size, setSize] = useState({ width: 300, height: 300 })
  const [lines, setLines] = useState([])
  const linesRef = useRef([])
  const [texts, setTexts] = useState([])
  const [isDrawing, setIsDrawing] = useState(false)

  useEffect(() => {
    if (!storageKey) return
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey))
      if (stored?.lines) {
        const normalized = stored.lines.map((line) => (line.id ? line : { ...line, id: makeId('line') }))
        setLines(normalized)
      }
      if (stored?.texts) {
        const normalized = stored.texts.map((text) => (text.id ? text : { ...text, id: makeId('text') }))
        setTexts(normalized)
      }
    } catch {
      // ignore storage errors
    }
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    localStorage.setItem(storageKey, JSON.stringify({ lines, texts }))
  }, [lines, texts, storageKey])

  useEffect(() => {
    onChange?.({ lines, texts })
  }, [lines, texts, onChange])

  useEffect(() => {
    if (!resetSignal) return
    setLines([])
    setTexts([])
  }, [resetSignal])

  useEffect(() => {
    linesRef.current = lines
  }, [lines])

  useEffect(() => {
    if (!exportSignal) return
    if (!stageRef.current) return
    try {
      const dataUrl = stageRef.current.toDataURL({ pixelRatio: 0.5 })
      onImageExport?.(dataUrl)
    } catch {
      // ignore export errors
    }
  }, [exportSignal, onImageExport])

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

  const handlePointerDown = (event) => {
    const stage = event.target.getStage()
    const point = stage.getPointerPosition()
    if (!point) return

    if (tool === 'text') {
      setTexts((prev) => [
        ...prev,
        { x: point.x, y: point.y, text: 'Note', id: makeId('text') },
      ])
      onStrokeComplete?.()
      return
    }

    const config = TOOL_CONFIG[tool] || TOOL_CONFIG.pen
    const newLine = {
      id: makeId('line'),
      tool,
      points: [point.x, point.y],
      stroke: config.stroke,
      width: config.width,
      opacity: config.opacity,
      composite: config.composite,
    }
    setLines((prev) => [...prev, newLine])
    setIsDrawing(true)
  }

  const handlePointerMove = (event) => {
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
    if (!isDrawing) return
    setIsDrawing(false)
    onStrokeComplete?.()
    const lastLine = linesRef.current[linesRef.current.length - 1]
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
              key={`line-${line.id || index}`}
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
          {overlayTexts.map((text, index) => (
            <Text
              key={text.id || `overlay-text-${index}`}
              x={text.x}
              y={text.y}
              text={text.text}
              fontSize={text.fontSize || 14}
              fill={text.fill || '#1f2937'}
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
}
