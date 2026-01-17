import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import NavBar from '../components/NavBar'
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
        navigate('/course/calculus')
      }
    }, 420)
  }

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <motion.section
        className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-16"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Optional diagnostic</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink md:text-4xl">{question.prompt}</h1>
          <p className="mt-2 text-base text-slate-500">{message}</p>
        </div>

        {question.type === 'mcq' && (
          <div className="grid gap-3">
            {question.options.map((option) => (
              <button
                key={option}
                onClick={() => advance(option)}
                className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-base font-semibold text-slate-700 transition hover:-translate-y-0.5"
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
              className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-base text-slate-700 outline-none transition focus:border-slate-300"
            />
            <PrimaryButton onClick={() => advance(shortAnswer || 'No response')} className="w-full">
              Submit
            </PrimaryButton>
          </div>
        )}

        {question.type === 'sketch' && (
          <div className="space-y-4">
            <div className="h-56 overflow-hidden rounded-2xl border border-slate-200 bg-white">
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
      </motion.section>
    </div>
  )
}
