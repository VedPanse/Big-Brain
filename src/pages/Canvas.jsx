import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import CanvasBoard from '../components/CanvasBoard'
import CanvasToolbar from '../components/CanvasToolbar'
import { courseStubs } from '../data/courseStubs'

const statusCopy = {
  idle: 'Idle',
  preparing: 'Preparing snapshot',
  analyzing: 'Analyzing canvas',
  ready: 'Suggestions ready',
  error: 'Needs attention',
}

const hintPhrases = [
  'Try labeling the axes near your sketch.',
  'Mark where the slope changes sign.',
  'Call out your assumptions beside the step.',
  'Circle the claim you are testing.',
]

function StatusBadge({ status }) {
  const tone = {
    idle: 'bg-slate-100 text-slate-700',
    preparing: 'bg-blue-50 text-blue-700',
    analyzing: 'bg-blue-50 text-blue-700',
    ready: 'bg-emerald-50 text-emerald-700',
    error: 'bg-rose-50 text-rose-700',
  }[status]

  const Icon =
    status === 'ready' ? CheckCircle2 : status === 'error' ? AlertTriangle : Sparkles

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
      <Icon size={14} />
      {statusCopy[status] || 'Idle'}
    </span>
  )
}

function CoachPanel({
  status,
  error,
  result,
  autoCoach,
  onToggleAuto,
  onAnalyze,
  onApplyFix,
  confusionRegions,
  analyzing,
  cooldownMs,
}) {
  const issues = useMemo(() => {
    const base = Array.isArray(result?.issues) ? result.issues : []
    if (!base.length) return []
    if (!confusionRegions?.length) return base
    const overlaps = (issue) => {
      if (!issue?.region) return false
      return confusionRegions.some((conf) => {
        const ix = issue.region.x ?? 0
        const iy = issue.region.y ?? 0
        const iw = issue.region.w ?? 0
        const ih = issue.region.h ?? 0
        const cx = conf.normalized?.x ?? 0
        const cy = conf.normalized?.y ?? 0
        const cw = conf.normalized?.w ?? 0
        const ch = conf.normalized?.h ?? 0
        return ix < cx + cw && ix + iw > cx && iy < cy + ch && iy + ih > cy
      })
    }
    return [...base].sort((a, b) => Number(overlaps(b)) - Number(overlaps(a)))
  }, [result?.issues, confusionRegions])

  return (
    <div className="glass-surface w-full rounded-3xl border border-slate-200/60 bg-white/70 p-5 shadow-sm backdrop-blur-lg">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Coach</p>
          <h3 className="text-lg font-semibold text-slate-900">AI feedback</h3>
        </div>
        <button
          onClick={onAnalyze}
          disabled={status === 'preparing' || status === 'analyzing' || analyzing || cooldownMs > 0}
          className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:scale-[0.99] hover:bg-slate-800 disabled:opacity-60"
        >
          {status === 'analyzing' || analyzing || status === 'preparing'
            ? 'Analyzing…'
            : cooldownMs > 0
              ? `Cooldown ${Math.ceil(cooldownMs / 1000)}s`
              : 'Analyze'}
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <StatusBadge status={status} />
        <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600">
          <input
            type="checkbox"
            checked={autoCoach}
            onChange={(e) => onToggleAuto(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-0"
          />
          Auto-coach
        </label>
      </div>
      {error ? (
        <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
          {error}
        </div>
      ) : null}
      {result?.summary ? (
        <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white/60 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Summary</p>
          <p className="mt-1 text-sm text-slate-800">{result.summary}</p>
          {result.detected_intent ? (
            <p className="mt-1 text-xs text-slate-500">Intent detected: {result.detected_intent}</p>
          ) : null}
        </div>
      ) : null}

      {issues.length ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
              Issues & focus
            </p>
          </div>
          {issues.map((issue, index) => (
            <div
              key={`${issue.type}-${index}`}
              className="rounded-2xl border border-slate-200/70 bg-white/70 px-3 py-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                      {issue.type || 'issue'}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-500">
                      Severity: {issue.severity || 'medium'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-800">{issue.message}</p>
                  {issue.suggested_fix ? (
                    <p className="text-xs text-slate-500">Fix: {issue.suggested_fix}</p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <button
                    onClick={() => onApplyFix(issue)}
                    className="rounded-full bg-slate-900 px-3 py-1 text-[11px] font-semibold text-white transition hover:scale-[0.99]"
                  >
                    Apply fix
                  </button>
                  {issue.region ? (
                    <span className="text-[11px] font-semibold text-slate-500">Pinned</span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {Array.isArray(result?.next_steps) && result.next_steps.length ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Next steps</p>
          <ul className="mt-2 space-y-2">
            {result.next_steps.map((step, idx) => (
              <li key={`step-${idx}`} className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2 text-sm text-slate-800">
                {step}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {Array.isArray(result?.micro_practice) && result.micro_practice.length ? (
        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Micro practice
          </p>
          <div className="mt-2 space-y-2">
            {result.micro_practice.map((item, idx) => (
              <div key={`mp-${idx}`} className="rounded-xl border border-slate-200/70 bg-white/60 px-3 py-2">
                <p className="text-sm font-semibold text-slate-800">{item.question}</p>
                <p className="text-xs text-slate-500">Hint: {item.hint}</p>
                <p className="text-xs text-slate-500">Answer: {item.answer}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function Canvas() {
  const { topic } = useParams()
  const course = courseStubs[topic] || courseStubs.calculus
  const [tool, setTool] = useState('pen')
  const [resetSignal, setResetSignal] = useState(0)
  const storageKey = useMemo(() => `canvas-${topic}-fullscreen`, [topic])
  const canvasRef = useRef(null)
  const [analysisStatus, setAnalysisStatus] = useState('idle')
  const [analysisResult, setAnalysisResult] = useState(null)
  const [autoCoach, setAutoCoach] = useState(true)
  const [lastInteraction, setLastInteraction] = useState(null)
  const [canvasState, setCanvasState] = useState({ lines: [], texts: [], confusions: [], size: {} })
  const [hint, setHint] = useState(null)
  const hintTimeout = useRef(null)
  const [stickyNotes, setStickyNotes] = useState([])
  const [ghostRegions, setGhostRegions] = useState([])
  const [error, setError] = useState('')
  const [confusionNote, setConfusionNote] = useState('')
  const [activePin, setActivePin] = useState(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [cooldownUntil, setCooldownUntil] = useState(0)
  const [lastAutoAnalysisAt, setLastAutoAnalysisAt] = useState(0)
  const [version, setVersion] = useState(0)
  const [lastAnalyzedVersion, setLastAnalyzedVersion] = useState(-1)
  const [forceAuto, setForceAuto] = useState(false)
  const [nowTick, setNowTick] = useState(Date.now())
  const cooldownRemaining = Math.max(0, cooldownUntil - nowTick)

  useEffect(() => {
    return () => {
      if (hintTimeout.current) clearTimeout(hintTimeout.current)
    }
  }, [])

  const onCanvasInteraction = useCallback((event) => {
    const now = Date.now()
    setLastInteraction(now)
    setVersion((v) => v + 1)
    if (event?.kind === 'confusion' && event.region?.note) {
      setConfusionNote(event.region.note)
      setForceAuto(true)
    }
  }, [])

  const handleHint = useCallback((point) => {
    if (!point) return
    const nextHint = hintPhrases[Math.floor(Math.random() * hintPhrases.length)]
    setHint({ ...point, text: nextHint })
    if (hintTimeout.current) clearTimeout(hintTimeout.current)
    hintTimeout.current = setTimeout(() => setHint(null), 2600)
  }, [])

  const compressPoints = (points) => {
    if (!Array.isArray(points) || points.length <= 60) return points || []
    const factor = Math.max(2, Math.round(points.length / 240))
    const result = []
    for (let i = 0; i < points.length; i += factor) {
      if (Number.isFinite(points[i]) && Number.isFinite(points[i + 1])) {
        result.push(points[i], points[i + 1])
      }
    }
    // ensure last point
    const end = points.length - 2
    if (Number.isFinite(points[end]) && result[result.length - 2] !== points[end]) {
      result.push(points[end], points[end + 1])
    }
    return result
  }

  const compressStrokes = (lines) =>
    (Array.isArray(lines) ? lines : []).map((line) => ({
      ...line,
      points: compressPoints(line.points),
    }))

  const handleAnalyze = useCallback(
    async (trigger = 'manual') => {
      if (!canvasRef.current) return
      if (isAnalyzing || cooldownRemaining > 0) return
      setIsAnalyzing(true)
      setAnalysisStatus('preparing')
      setError('')
      try {
        const state = canvasRef.current.getState()
        const { width = 0, height = 0 } = state.size || {}
        const longest = Math.max(width, height) || 1
        const target = 1024
        const pixelRatio = Math.min(1, target / longest)
        const snapshot = canvasRef.current.exportImage({
          pixelRatio,
          quality: 0.7,
          mimeType: 'image/jpeg',
        })

        if (!snapshot) {
          throw new Error('Unable to capture canvas snapshot.')
        }

        setAnalysisStatus('analyzing')

        const payload = {
          image: snapshot,
          strokes: compressStrokes(state.lines),
          texts: state.texts,
          confusionRegions: state.confusions,
          context: {
            topic: course.title,
            nodeId: topic,
            trigger,
          },
        }

        const isDev = import.meta.env?.MODE !== 'production'
        if (isDev) {
          const approxKb = Math.round(JSON.stringify(payload).length / 1024)
          // eslint-disable-next-line no-console
          console.log('[canvas] analyze start', { trigger, kb: approxKb })
        }

        const response = await fetch('/api/canvas/analyze', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })

        if (!response.ok) {
          const message = await response.json().catch(() => ({}))
          if (response.status === 429 || message.error === 'rate_limited') {
            const retryMs = Number(message.retry_after_ms) || 8000
            setCooldownUntil(Date.now() + retryMs)
            setError('Rate limited. Please slow down…')
            setAnalysisStatus('error')
          } else {
            throw new Error(message.error || 'Analysis failed. Try again.')
          }
          return
        }

        const data = await response.json()
        setAnalysisResult(data)
        setActivePin(null)
        setAnalysisStatus('ready')
        setLastAnalyzedVersion(version)
        if (trigger === 'auto') {
          setLastAutoAnalysisAt(Date.now())
        }
      } catch (err) {
        setError(err.message)
        setAnalysisStatus('error')
      } finally {
        setIsAnalyzing(false)
        const isDev = import.meta.env?.MODE !== 'production'
        if (isDev) {
          // eslint-disable-next-line no-console
          console.log('[canvas] analyze end')
        }
      }
    },
    [canvasRef, cooldownRemaining, course.title, topic, isAnalyzing, version],
  )

  useEffect(() => {
    if (!cooldownUntil) return undefined
    const id = setInterval(() => setNowTick(Date.now()), 500)
    return () => clearInterval(id)
  }, [cooldownUntil])

  useEffect(() => {
    if (!autoCoach) return
    if (isAnalyzing || cooldownRemaining > 0) return
    const now = Date.now()
    const sinceLast = lastInteraction ? now - lastInteraction : Infinity
    const canThrottle = now - lastAutoAnalysisAt >= 10000
    const changed = version !== lastAnalyzedVersion
    if (!changed) return

    if (forceAuto && canThrottle) {
      setForceAuto(false)
      handleAnalyze('auto')
      return undefined
    }

    if (!lastInteraction || sinceLast < 3000 || !canThrottle) return
    const timer = setTimeout(() => {
      handleAnalyze('auto')
    }, 120)
    return () => clearTimeout(timer)
  }, [
    autoCoach,
    lastInteraction,
    isAnalyzing,
    cooldownRemaining,
    lastAutoAnalysisAt,
    version,
    lastAnalyzedVersion,
    forceAuto,
    handleAnalyze,
  ])

  const handleApplyFix = useCallback((issue) => {
    if (!issue) return
    const noteId = `note-${Date.now()}`
    if (issue.suggested_fix && issue.region) {
      setStickyNotes((prev) => [
        ...prev,
        { id: noteId, text: issue.suggested_fix, region: issue.region },
      ])
    }
    if (issue.region) {
      setGhostRegions((prev) => [
        ...prev,
        {
          id: `ghost-${Date.now()}`,
          region: issue.region,
          label: issue.message || 'Ghost suggestion',
        },
      ])
    }
  }, [])

  const toPixelRegion = useCallback(
    (region) => {
      const { width = 0, height = 0 } = canvasState.size || {}
      if (!region || !width || !height) return null
      const x = (region.x || 0) * width
      const y = (region.y || 0) * height
      const w = (region.w || 0) * width
      const h = (region.h || 0) * height
      return { x, y, w, h }
    },
    [canvasState.size],
  )

  const issuePins = useMemo(() => {
    const issues = Array.isArray(analysisResult?.issues) ? analysisResult.issues : []
    return issues
      .filter((issue) => issue.region && toPixelRegion(issue.region))
      .map((issue, index) => {
        const rect = toPixelRegion(issue.region)
        return { ...issue, rect, index }
      })
  }, [analysisResult?.issues, toPixelRegion])

  const focusRegions = useMemo(() => {
    const focus = Array.isArray(analysisResult?.focus_regions) ? analysisResult.focus_regions : []
    return focus
      .filter((entry) => entry.region && toPixelRegion(entry.region))
      .map((entry, idx) => ({ ...entry, rect: toPixelRegion(entry.region), index: idx }))
  }, [analysisResult?.focus_regions, toPixelRegion])

  const handleClear = () => {
    setResetSignal((prev) => prev + 1)
    setAnalysisResult(null)
    setGhostRegions([])
    setStickyNotes([])
    setError('')
    setAnalysisStatus('idle')
    setActivePin(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Canvas</p>
            <h1 className="text-2xl font-semibold text-ink">{course.title}</h1>
            <p className="text-sm text-slate-500">AI coaches directly on your strokes.</p>
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
        className="mx-auto grid w-full max-w-6xl gap-5 px-6 py-8 lg:grid-cols-[1.65fr_1fr]"
      >
        <div>
          <div className="flex items-center justify-between gap-3">
            <CanvasToolbar activeTool={tool} onChange={setTool} onClear={handleClear} />
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={confusionNote}
                onChange={(e) => setConfusionNote(e.target.value)}
                placeholder="Note for confusion highlights (optional)"
                className="w-56 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              />
              <p className="text-xs font-semibold text-slate-500">Saved automatically.</p>
            </div>
          </div>

          <div className="relative mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur-lg">
            <div className="h-[70vh]">
              <CanvasBoard
                ref={canvasRef}
                tool={tool}
                confusionNote={confusionNote}
                storageKey={storageKey}
                resetSignal={resetSignal}
                onInteraction={onCanvasInteraction}
                onPointerPause={handleHint}
                onStateChange={setCanvasState}
              />
            </div>

            <AnimatePresence>
              {hint ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24 }}
                  style={{ left: hint.x, top: hint.y }}
                  className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full rounded-2xl border border-slate-200 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-700 shadow-lg backdrop-blur"
                >
                  {hint.text}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {issuePins.map((issue) => (
              <button
                key={`pin-${issue.index}`}
                style={{ left: issue.rect.x + issue.rect.w / 2, top: issue.rect.y }}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-900/80 px-2 py-1 text-[10px] font-semibold text-white shadow-lg backdrop-blur"
                title={issue.message}
                onClick={() => setActivePin(issue)}
              >
                {issue.type || 'issue'}
              </button>
            ))}

            {focusRegions.map((focus) => (
              <div
                key={`focus-${focus.index}`}
                style={{
                  left: focus.rect.x,
                  top: focus.rect.y,
                  width: focus.rect.w,
                  height: focus.rect.h,
                }}
                className="absolute z-10 rounded-2xl border border-indigo-300/70 bg-indigo-50/40"
                >
                  <span className="absolute left-2 top-2 rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-semibold text-white">
                    Focus
                  </span>
                </div>
            ))}

            <AnimatePresence>
              {activePin ? (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.24 }}
                  style={{
                    left: activePin.rect.x + activePin.rect.w / 2,
                    top: activePin.rect.y + activePin.rect.h + 12,
                  }}
                  className="absolute z-20 max-w-xs -translate-x-1/2 rounded-2xl border border-slate-200 bg-white/90 px-3 py-3 text-xs font-semibold text-slate-800 shadow-xl backdrop-blur"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                      {activePin.type || 'issue'}
                    </span>
                    <button
                      onClick={() => setActivePin(null)}
                      className="text-[10px] font-semibold text-slate-500 hover:text-slate-700"
                    >
                      Close
                    </button>
                  </div>
                  <p className="mt-2 text-sm text-slate-800">{activePin.message}</p>
                  {activePin.suggested_fix ? (
                    <p className="mt-1 text-[11px] text-slate-500">Fix: {activePin.suggested_fix}</p>
                  ) : null}
                </motion.div>
              ) : null}
            </AnimatePresence>

            {ghostRegions.map((ghost) => {
              const rect = toPixelRegion(ghost.region)
              if (!rect) return null
              return (
                <div
                  key={ghost.id}
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: rect.w,
                    height: rect.h,
                  }}
                  className="absolute z-10 rounded-2xl border border-emerald-300/70 bg-emerald-50/30 backdrop-blur-sm"
                >
                  <span className="absolute left-2 bottom-2 rounded-full bg-emerald-600 px-2 py-1 text-[10px] font-semibold text-white">
                    {ghost.label}
                  </span>
                </div>
              )
            })}

            {stickyNotes.map((note) => {
              const rect = toPixelRegion(note.region)
              if (!rect) return null
              return (
                <div
                  key={note.id}
                  style={{ left: rect.x + rect.w / 2, top: rect.y + rect.h / 2 }}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 shadow-md"
                >
                  {note.text}
                </div>
              )
            })}
          </div>
        </div>

        <CoachPanel
          status={analysisStatus}
          error={error}
          result={analysisResult}
          autoCoach={autoCoach}
          onToggleAuto={setAutoCoach}
          onAnalyze={() => handleAnalyze('manual')}
          onApplyFix={handleApplyFix}
          confusionRegions={canvasState.confusions}
          analyzing={isAnalyzing}
          cooldownMs={cooldownRemaining}
        />
      </motion.div>
    </div>
  )
}
