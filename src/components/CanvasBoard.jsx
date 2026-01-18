import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Line, Text, Rect, Circle, Arrow } from 'react-konva'

const TOOL_CONFIG = {
  pen: { stroke: '#1e293b', width: 3, opacity: 1, composite: 'source-over' },
  highlighter: { stroke: '#2f6bff', width: 12, opacity: 0.2, composite: 'source-over' },
  eraser: { stroke: '#ffffff', width: 20, opacity: 1, composite: 'destination-out' },
}

export default function CanvasBoard({
  tool,
  onStrokeComplete,
  overlays = [],
  onPointerPause,
  onSizeChange,
  onStateChange,
  storageKey,
  resetSignal,
  aiState,
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
      if (stored?.lines) setLines(stored.lines)
      if (stored?.texts) setTexts(stored.texts)
    } catch {
      // ignore storage errors
    }
  }, [storageKey])

  useEffect(() => {
    if (!storageKey) return
    localStorage.setItem(storageKey, JSON.stringify({ lines, texts }))
  }, [lines, texts, storageKey])

  useEffect(() => {
    onStateChange?.({ lines, texts })
  }, [lines, texts, onStateChange])

  useEffect(() => {
    if (!resetSignal) return
    setLines([])
    setTexts([])
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

  const handlePointerDown = (event) => {
    const stage = event.target.getStage()
    const point = stage.getPointerPosition()
    if (!point) return

    if (tool === 'text') {
      setTexts((prev) => [
        ...prev,
        { x: point.x, y: point.y, text: 'Note', id: `text-${prev.length}` },
      ])
      onStrokeComplete?.()
      return
    }

    const config = TOOL_CONFIG[tool] || TOOL_CONFIG.pen
    const newLine = {
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
          {(aiState?.shapes || []).map((shape) => {
            const highlight = aiState?.highlights?.find((item) => item.id === shape.id)
            const strokeColor =
              highlight?.level === 'error'
                ? '#f97316'
                : highlight?.level === 'warn'
                  ? '#facc15'
                  : highlight?.level === 'info'
                    ? '#38bdf8'
                    : shape.style?.stroke || '#1e293b'
            if (shape.shape === 'rect') {
              return (
                <Rect
                  key={shape.id}
                  x={shape.x}
                  y={shape.y}
                  width={shape.w}
                  height={shape.h}
                  stroke={strokeColor}
                  strokeWidth={shape.style?.strokeWidth || 2}
                  fill={shape.style?.fill || 'transparent'}
                />
              )
            }
            if (shape.shape === 'circle') {
              return (
                <Circle
                  key={shape.id}
                  x={shape.x}
                  y={shape.y}
                  radius={Math.max(shape.w, shape.h) / 2}
                  stroke={strokeColor}
                  strokeWidth={shape.style?.strokeWidth || 2}
                  fill={shape.style?.fill || 'transparent'}
                />
              )
            }
            if (shape.shape === 'arrow') {
              return (
                <Arrow
                  key={shape.id}
                  points={[shape.x, shape.y, shape.w, shape.h]}
                  stroke={strokeColor}
                  fill={strokeColor}
                  pointerLength={10}
                  pointerWidth={10}
                  strokeWidth={shape.style?.strokeWidth || 2}
                />
              )
            }
            if (shape.shape === 'line') {
              return (
                <Line
                  key={shape.id}
                  points={[shape.x, shape.y, shape.w, shape.h]}
                  stroke={strokeColor}
                  strokeWidth={shape.style?.strokeWidth || 2}
                />
              )
            }
            return null
          })}
          {(aiState?.connections || []).map((conn) => {
            const from = aiState?.shapes?.find((shape) => shape.id === conn.fromId)
            const to = aiState?.shapes?.find((shape) => shape.id === conn.toId)
            if (!from || !to) return null
            const fromX = from.x + from.w / 2
            const fromY = from.y + from.h / 2
            const toX = to.x + to.w / 2
            const toY = to.y + to.h / 2
            return (
              <Arrow
                key={conn.id}
                points={[fromX, fromY, toX, toY]}
                stroke="#64748b"
                fill="#64748b"
                strokeWidth={2}
                pointerLength={8}
                pointerWidth={8}
              />
            )
          })}
          {(aiState?.texts || []).map((note) => (
            <Text
              key={note.id}
              x={note.x}
              y={note.y}
              text={note.text}
              fontSize={note.style?.fontSize || 14}
              fill={note.style?.fill || '#334155'}
            />
          ))}
          {(aiState?.highlights || []).map((highlight) => {
            if (!highlight.note) return null
            const target = aiState?.shapes?.find((shape) => shape.id === highlight.id)
            if (!target) return null
            return (
              <Text
                key={`${highlight.id}-note`}
                x={target.x + target.w + 6}
                y={target.y - 4}
                text={highlight.note}
                fontSize={12}
                fill="#b45309"
              />
            )
          })}
        </Layer>
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
}
