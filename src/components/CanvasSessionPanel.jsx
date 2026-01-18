import { useMemo, useState } from 'react'
import PrimaryButton from './PrimaryButton'
import SecondaryButton from './SecondaryButton'
import { validateCanvasCommand } from '../shared/canvasProtocol'

const MAX_CHARS = 3000

const modes = [
  { id: 'tutor', label: 'Tutor (Canvas)' },
  { id: 'teachback', label: 'Teach-Back (Canvas)' },
]

const formatRubricLabel = (key) => key.replace(/_/g, ' ')

const getMissingPoints = (rubric) => {
  if (!rubric) return []
  return Object.entries(rubric)
    .filter(([, value]) => (value?.score ?? 0) < 2)
    .map(([key, value]) => `${formatRubricLabel(key)}: ${value?.note || 'Needs improvement.'}`)
    .slice(0, 3)
}

export default function CanvasSessionPanel({ concept, canvasState, onCanvasCommand }) {
  const [mode, setMode] = useState('tutor')
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [error, setError] = useState('')
  const [log, setLog] = useState([])

  const [teachbackSessionId, setTeachbackSessionId] = useState(null)
  const [teachbackStatus, setTeachbackStatus] = useState(null)
  const [teachbackRubric, setTeachbackRubric] = useState(null)
  const [teachbackNextStep, setTeachbackNextStep] = useState('')
  const [teachbackRounds, setTeachbackRounds] = useState(0)

  const missingPoints = useMemo(() => getMissingPoints(teachbackRubric), [teachbackRubric])

  const appendLog = (entry) => {
    setLog((prev) => [...prev, { id: `${Date.now()}-${prev.length}`, ...entry }].slice(-8))
  }

  const handleCommand = (command) => {
    if (!command) return
    const validation = validateCanvasCommand(command)
    if (!validation.ok) {
      appendLog({ title: 'Canvas', detail: `Command rejected: ${validation.error}` })
      return
    }
    onCanvasCommand?.(command)
    appendLog({ title: 'Canvas', detail: 'Diagram updated' })
  }

  const handleTutorSend = async (message) => {
    if (!message.trim()) return
    if (message.length > MAX_CHARS) {
      setError('Please keep the message under 3000 characters.')
      return
    }
    setThinking(true)
    setError('')
    try {
      const response = await fetch('/api/canvas/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptTitle: concept.title,
          conceptDescription: concept.description,
          userMessage: message.trim(),
          transcript: log.map((entry) => entry.detail),
          canvasState,
        }),
      })
      if (!response.ok) {
        const message = await response.json().catch(() => ({}))
        throw new Error(message.error || 'Tutor response failed.')
      }
      const data = await response.json()
      appendLog({ title: 'You', detail: message.trim() })
      appendLog({ title: 'AI', detail: data.reply })
      handleCommand(data.canvasCommand)
      setInput('')
    } catch (err) {
      setError(err.message || 'Tutor response failed.')
    } finally {
      setThinking(false)
    }
  }

  const handleTeachBackStart = async () => {
    if (!input.trim()) return
    if (input.length > MAX_CHARS) {
      setError('Please keep the explanation under 3000 characters.')
      return
    }
    setThinking(true)
    setError('')
    try {
      const response = await fetch('/api/teachback/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conceptId: concept.id,
          conceptTitle: concept.title,
          conceptDescription: concept.description,
          userExplanation: input.trim(),
          canvasSnapshot: canvasState,
        }),
      })
      if (!response.ok) {
        const message = await response.json().catch(() => ({}))
        throw new Error(message.error || 'Teach-back failed to start.')
      }
      const data = await response.json()
      setTeachbackSessionId(data.sessionId)
      setTeachbackStatus(data.status)
      setTeachbackRubric(data.rubricBreakdown)
      setTeachbackNextStep(data.nextStep || '')
      setTeachbackRounds(1)
      appendLog({ title: 'You', detail: input.trim() })
      appendLog({ title: 'AI', detail: data.aiMessage })
      if (data.interruptions?.length) {
        appendLog({ title: 'Interruptions', detail: `${data.interruptions.length} flagged` })
      }
      if (data.nextQuestions?.length) {
        appendLog({ title: 'Questions', detail: `${data.nextQuestions.length} follow-ups` })
      }
      setInput('')
    } catch (err) {
      setError(err.message || 'Teach-back failed to start.')
    } finally {
      setThinking(false)
    }
  }

  const handleTeachBackReply = async (overrideMessage) => {
    const message = (overrideMessage ?? input).trim()
    if (!message || !teachbackSessionId) return
    if (message.length > MAX_CHARS) {
      setError('Please keep the reply under 3000 characters.')
      return
    }
    setThinking(true)
    setError('')
    try {
      const response = await fetch('/api/teachback/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: teachbackSessionId,
          userReply: message,
          canvasSnapshot: canvasState,
        }),
      })
      if (!response.ok) {
        const message = await response.json().catch(() => ({}))
        throw new Error(message.error || 'Teach-back reply failed.')
      }
      const data = await response.json()
      setTeachbackStatus(data.status)
      setTeachbackRubric(data.rubricBreakdown)
      setTeachbackNextStep(data.nextStep || '')
      setTeachbackRounds((prev) => prev + 1)
      appendLog({ title: 'You', detail: message })
      appendLog({ title: 'AI', detail: data.aiMessage })
      if (data.interruptions?.length) {
        appendLog({ title: 'Interruptions', detail: `${data.interruptions.length} flagged` })
      }
      if (data.nextQuestions?.length) {
        appendLog({ title: 'Questions', detail: `${data.nextQuestions.length} follow-ups` })
      }
      setInput('')
    } catch (err) {
      setError(err.message || 'Teach-back reply failed.')
    } finally {
      setThinking(false)
    }
  }

  const handleTeachBackStuck = async () => {
    if (!teachbackSessionId) return
    await handleTeachBackReply("I'm stuck.")
  }

  const handleSendDiagram = () => {
    handleTutorSend('Analyze my diagram and call out errors or gaps.')
  }

  const canTeachBackReply = teachbackSessionId && teachbackStatus !== 'PASS' && teachbackRounds < 4

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
            Canvas session
          </p>
          <h3 className="mt-2 text-lg font-semibold text-slate-900">{concept.title}</h3>
        </div>
        <div className="flex flex-wrap gap-2">
          {modes.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                setMode(option.id)
                setError('')
              }}
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                mode === option.id
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        {mode === 'tutor'
          ? 'Describe what you drew or ask for guidance. The AI will correct diagrams and add annotations.'
          : 'Teach the concept back. The AI will interrupt vague reasoning and assess mastery.'}
      </p>

      <div className="mt-4 space-y-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value.slice(0, MAX_CHARS))}
          placeholder={mode === 'tutor' ? 'Explain what you drew or ask a question...' : 'Teach it back here...'}
          className="h-24 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none focus:border-slate-300"
        />
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>{input.length}/{MAX_CHARS}</span>
          <div className="flex flex-wrap gap-2">
            {mode === 'tutor' ? (
              <>
                <SecondaryButton onClick={handleSendDiagram} disabled={thinking}>
                  Send diagram to AI
                </SecondaryButton>
                <PrimaryButton
                  onClick={() => handleTutorSend(input)}
                  disabled={thinking || !input.trim()}
                >
                  {thinking ? 'Thinking...' : 'Send'}
                </PrimaryButton>
              </>
            ) : (
              <>
                <SecondaryButton
                  onClick={handleTeachBackStuck}
                  disabled={!canTeachBackReply || thinking}
                >
                  {teachbackSessionId ? "I'm stuck" : 'Hold'}
                </SecondaryButton>
                <PrimaryButton
                  onClick={teachbackSessionId ? handleTeachBackReply : handleTeachBackStart}
                  disabled={thinking || !input.trim()}
                >
                  {thinking ? 'Thinking...' : teachbackSessionId ? 'Reply' : 'Start Teach-Back'}
                </PrimaryButton>
              </>
            )}
          </div>
        </div>
      </div>

      {teachbackStatus === 'PASS' && (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <p className="font-semibold">Mastered ✅</p>
          <p className="mt-2">Your explanation met the rubric.</p>
        </div>
      )}

      {teachbackStatus === 'FAIL' && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <p className="font-semibold">Not yet</p>
          {missingPoints.length > 0 && (
            <div className="mt-2 space-y-1">
              {missingPoints.map((point, idx) => (
                <p key={`missing-${idx}`}>{point}</p>
              ))}
            </div>
          )}
          {teachbackNextStep && <p className="mt-2">Next step: {teachbackNextStep}</p>}
        </div>
      )}

      {log.length > 0 && (
        <div className="mt-4 space-y-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-600">
          {log.map((entry) => (
            <div key={entry.id} className="flex items-start justify-between gap-2">
              <span className="font-semibold text-slate-500">{entry.title}</span>
              <span className="text-right">{entry.detail}</span>
            </div>
          ))}
        </div>
      )}

      {error && <p className="mt-3 text-xs text-rose-600">{error}</p>}
    </div>
  )
}
