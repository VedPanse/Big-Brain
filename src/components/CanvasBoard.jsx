import { useEffect, useRef, useState } from 'react'
import { Stage, Layer, Line, Text } from 'react-konva'

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
