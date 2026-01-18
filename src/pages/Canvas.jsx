import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { RoomEvent } from 'livekit-client'
import CanvasBoard from '../components/CanvasBoard'
import CanvasToolbar from '../components/CanvasToolbar'
import { courseStubs } from '../data/courseStubs'
import LiveKitVoicePanel from '../components/Voice/LiveKitVoicePanel'
import { CANVAS_COMMANDS, isCanvasCommand } from '../shared/canvasCommands'

export default function Canvas() {
  const { topic } = useParams()
  const course = courseStubs[topic] || courseStubs.calculus
  const [tool, setTool] = useState('pen')
  const [resetSignal, setResetSignal] = useState(0)
  const storageKey = useMemo(() => `canvas-${topic}-fullscreen`, [topic])
  const [canvasSnapshot, setCanvasSnapshot] = useState({ lines: [], texts: [] })
  const [highlights, setHighlights] = useState([])
  const [overlayTexts, setOverlayTexts] = useState([])
  const [taIndicator, setTaIndicator] = useState(null)
  const [canvasExportSignal, setCanvasExportSignal] = useState(0)
  const sendDataRef = useRef(null)
  const imageTimerRef = useRef(null)
  const sendTimerRef = useRef(null)
  const lastSentAtRef = useRef(0)
  const lastImageAtRef = useRef(0)
  const identity = useMemo(() => `canvas-user-${Date.now()}`, [])

  const downsamplePoints = (points, maxPoints = 200) => {
    if (!Array.isArray(points) || points.length <= maxPoints * 2) return points
    const stride = Math.ceil(points.length / (maxPoints * 2))
    return points.filter((_, index) => index % stride === 0)
  }

  const exportCanvasState = useCallback(() => {
    const elements = [
      ...canvasSnapshot.lines.map((line) => ({
        id: line.id,
        type: line.tool === 'eraser' ? 'scribble' : 'line',
        points: downsamplePoints(line.points || []),
        color: line.stroke,
        meta: { width: line.width, opacity: line.opacity, tool: line.tool },
      })),
      ...canvasSnapshot.texts.map((text) => ({
        id: text.id,
        type: 'text',
        x: text.x,
        y: text.y,
        text: text.text,
      })),
    ]

    return {
      conceptId: topic,
      viewport: { zoom: 1, panX: 0, panY: 0 },
      elements,
      updatedAt: new Date().toISOString(),
    }
  }, [canvasSnapshot.lines, canvasSnapshot.texts, topic])

  const sendCanvasState = useCallback(() => {
    if (!sendDataRef.current) return
    const payload = { type: 'CANVAS_STATE', ...exportCanvasState() }
    const bytes = new TextEncoder().encode(JSON.stringify(payload)).length
    sendDataRef.current('bb.canvas.state', payload)
    console.log('[CanvasState] sent', { bytes, elements: payload.elements.length })
    lastSentAtRef.current = Date.now()
  }, [exportCanvasState])

  const scheduleCanvasSend = useCallback(() => {
    if (!sendDataRef.current) return
    const now = Date.now()
    if (now - lastSentAtRef.current > 280) {
      sendCanvasState()
      return
    }
    if (sendTimerRef.current) {
      clearTimeout(sendTimerRef.current)
    }
    sendTimerRef.current = setTimeout(sendCanvasState, 280)
  }, [sendCanvasState])

  const handleCanvasChange = useCallback(
    (nextState) => {
      setCanvasSnapshot(nextState)
      scheduleCanvasSend()
      const now = Date.now()
      if (now - lastImageAtRef.current > 1200) {
        setCanvasExportSignal((value) => value + 1)
        lastImageAtRef.current = now
      } else if (!imageTimerRef.current) {
        imageTimerRef.current = setTimeout(() => {
          setCanvasExportSignal((value) => value + 1)
          lastImageAtRef.current = Date.now()
          imageTimerRef.current = null
        }, 1200)
      }
    },
    [scheduleCanvasSend],
  )

  const resolveElementCenter = useCallback(() => {
    const firstLine = canvasSnapshot.lines[0]
    if (firstLine?.points?.length >= 2) {
      const [x, y] = firstLine.points.slice(-2)
      return { x, y }
    }
    const firstText = canvasSnapshot.texts[0]
    if (firstText) return { x: firstText.x, y: firstText.y }
    return { x: 120, y: 120 }
  }, [canvasSnapshot.lines, canvasSnapshot.texts])

  const applyCanvasCommand = useCallback(
    (command) => {
      if (!isCanvasCommand(command)) return
      if (command.op === CANVAS_COMMANDS.CLEAR_HIGHLIGHTS) {
        setHighlights([])
        setOverlayTexts([])
        setTaIndicator(null)
        return
      }

      if (command.op === CANVAS_COMMANDS.ADD_TEXT) {
        setOverlayTexts((prev) => [
          ...prev,
          {
            id: `ta-text-${Date.now()}`,
            x: command.x ?? resolveElementCenter().x,
            y: command.y ?? resolveElementCenter().y,
            text: command.text || 'Check this.',
            fill: command.style?.color || '#111827',
            fontSize: command.style?.fontSize || 14,
          },
        ])
      }

      if (command.op === CANVAS_COMMANDS.ZOOM_TO) {
        const center = resolveElementCenter()
        setTaIndicator({
          note: command.note || 'TA pointed here',
          level: command.level || 'info',
          x: center.x,
          y: center.y,
        })
      }

      if (command.op === CANVAS_COMMANDS.HIGHLIGHT) {
        const color =
          command.level === 'error'
            ? '#ef4444'
            : command.level === 'warn'
              ? '#f59e0b'
              : '#2563eb'
        const targetLine = canvasSnapshot.lines.find((line) => line.id === command.targetId)
        if (targetLine) {
          setHighlights([
            {
              points: targetLine.points,
              stroke: color,
              width: (targetLine.width || 3) + 6,
              opacity: 0.9,
              dash: [10, 6],
            },
          ])
        } else {
          const center = resolveElementCenter()
          setHighlights([
            {
              points: [center.x - 30, center.y - 30, center.x + 30, center.y + 30],
              stroke: color,
              width: 4,
              opacity: 0.8,
              dash: [6, 6],
            },
          ])
        }
        setTaIndicator({
          note: command.note || 'TA pointed here',
          level: command.level || 'info',
        })
        console.log('[CanvasCmd] applied', command)
      }
    },
    [canvasSnapshot.lines, resolveElementCenter],
  )

  const handleRoomConnected = useCallback(
    (room) => {
      room.on(RoomEvent.DataReceived, (payload) => {
        try {
          const text = new TextDecoder().decode(payload)
          const message = JSON.parse(text)
          if (message?.topic !== 'bb.canvas.cmd') return
          console.log('[CanvasCmd] received', message.payload?.op)
          applyCanvasCommand(message.payload)
        } catch (error) {
          console.warn('[CanvasCmd] parse failed', error)
        }
      })
    },
    [applyCanvasCommand],
  )

  const handleSetContext = useCallback(
    (setter) => {
      setContextRef.current = setter
      setter({
        conceptTitle: course.title,
        conceptSummary: course.subtitle,
        problemPrompt: 'Explain your diagram and reasoning aloud.',
      })
    },
    [course.subtitle, course.title],
  )

  const handleSendDataReady = useCallback((sender) => {
    sendDataRef.current = sender
    sendCanvasState()
  }, [sendCanvasState])

  const handleCanvasImageExport = useCallback((dataUrl) => {
    if (!sendDataRef.current || !dataUrl) return
    const payload = { type: 'CANVAS_IMAGE', dataUrl, conceptId: topic }
    const bytes = new TextEncoder().encode(JSON.stringify(payload)).length
    if (bytes > 220000) {
      console.warn('[CanvasImage] skipped, too large', { bytes })
      return
    }
    sendDataRef.current('bb.canvas.image', payload)
    console.log('[CanvasImage] sent', { bytes })
  }, [topic])

  useEffect(() => {
    return () => {
      if (sendTimerRef.current) {
        clearTimeout(sendTimerRef.current)
      }
      if (imageTimerRef.current) {
        clearTimeout(imageTimerRef.current)
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Canvas</p>
            <h1 className="text-2xl font-semibold text-ink">{course.title}</h1>
          </div>
          <Link to={`/course/${topic}`} className="text-sm font-semibold text-slate-500 hover:text-slate-700">
            Back to course
          </Link>
        </div>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="mx-auto w-full max-w-6xl px-6 py-10"
      >
        <div className="flex items-center justify-between">
          <CanvasToolbar
            activeTool={tool}
            onChange={setTool}
            onClear={() => setResetSignal((prev) => prev + 1)}
          />
          <p className="text-sm text-slate-500">Saved automatically for this topic.</p>
        </div>
        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white">
          <div className="relative h-[70vh]">
            {taIndicator && (
              <div className="pointer-events-none absolute left-5 top-5 z-10">
                <div className="rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                  TA pointed here · {taIndicator.note}
                </div>
              </div>
            )}
            <CanvasBoard
              tool={tool}
              storageKey={storageKey}
              resetSignal={resetSignal}
              overlays={highlights}
              overlayTexts={overlayTexts}
              onChange={handleCanvasChange}
              onImageExport={handleCanvasImageExport}
              exportSignal={canvasExportSignal}
            />
            <div className="pointer-events-auto absolute bottom-6 right-6">
              <LiveKitVoicePanel
                roomName={`topic-${topic}-user-demo`}
                identity={identity}
                mode="TA_OFFICE_HOURS"
                conceptId={topic}
                onConnected={handleRoomConnected}
                sendData={handleSendDataReady}
                setContext={handleSetContext}
              />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
