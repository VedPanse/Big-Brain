import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import PrimaryButton from '../components/PrimaryButton'
import ProgressDots from '../components/ProgressDots'
import CanvasBoard from '../components/CanvasBoard'
import { diagnosticQuestions } from '../data/mockDiagnostic'
import { scoreDiagnostic } from '../utils/scoreDiagnostic'
import { useLearning } from '../state/LearningContext'

export default function Diagnostic() {
  const navigate = useNavigate()
  const { completeDiagnostic } = useLearning()
  const total = diagnosticQuestions.length
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState([])
  const [note, setNote] = useState(false)
  const [shortAnswer, setShortAnswer] = useState('')
  const [sketchSteps, setSketchSteps] = useState(0)

  const question = diagnosticQuestions[index]

  const message = useMemo(() => {
    if (index === total - 1) return 'Final pulse check.'
    return 'Quick signal check.'
  }, [index, total])

  const advance = (value) => {
    const nextAnswers = [...answers, value]
    setAnswers(nextAnswers)
    setNote(true)

    setTimeout(() => {
      setNote(false)
      if (index < total - 1) {
        setIndex((prev) => prev + 1)
        setShortAnswer('')
        setSketchSteps(0)
      } else {
        const scored = scoreDiagnostic(nextAnswers)
        completeDiagnostic({ ...scored, answers: nextAnswers })
        navigate('/graph')
      }
    }, 420)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <motion.div
        className="w-full max-w-xl"
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      >
        <GlassCard className="space-y-6">
          <div className="space-y-2 text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Diagnostic</p>
            <h2 className="text-2xl font-semibold text-slate-900">{question.prompt}</h2>
            <p className="text-sm text-slate-500">{message}</p>
          </div>

          {question.type === 'mcq' && (
            <div className="grid gap-3">
              {question.options.map((option) => (
                <button
                  key={option}
                  onClick={() => advance(option)}
                  className="rounded-2xl border border-white/50 bg-white/70 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:-translate-y-0.5 hover:bg-white"
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          {question.type === 'short' && (
            <div className="space-y-4">
              <input
                value={shortAnswer}
                onChange={(event) => setShortAnswer(event.target.value)}
                placeholder={question.placeholder}
                className="w-full rounded-2xl border border-white/50 bg-white/70 px-4 py-3 text-sm text-slate-700 shadow-sm outline-none transition focus:border-[color:var(--accent)]"
              />
              <PrimaryButton onClick={() => advance(shortAnswer || 'No response')} className="w-full">
                Submit
              </PrimaryButton>
            </div>
          )}

          {question.type === 'sketch' && (
            <div className="space-y-4">
              <div className="h-56 overflow-hidden rounded-2xl border border-white/40 bg-white/40">
                <CanvasBoard tool="pen" onStrokeComplete={() => setSketchSteps((prev) => prev + 1)} />
              </div>
              <PrimaryButton
                onClick={() => advance(sketchSteps > 0 ? 'Sketch complete' : 'Sketch skipped')}
                className="w-full"
              >
                Continue
              </PrimaryButton>
            </div>
          )}

          {note && <p className="text-center text-sm font-semibold text-slate-500">Noted.</p>}
          <ProgressDots total={total} current={index} />
        </GlassCard>
      </motion.div>
    </div>
  )
}
