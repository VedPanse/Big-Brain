import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import CanvasBoard from '../components/CanvasBoard'
import CanvasToolbar from '../components/CanvasToolbar'
import { courseStubs } from '../data/courseStubs'

export default function Canvas() {
  const { topic } = useParams()
  const course = courseStubs[topic] || courseStubs.calculus
  const [tool, setTool] = useState('pen')
  const [resetSignal, setResetSignal] = useState(0)
  const storageKey = useMemo(() => `canvas-${topic}-fullscreen`, [topic])

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
          <div className="h-[70vh]">
            <CanvasBoard tool={tool} storageKey={storageKey} resetSignal={resetSignal} />
          </div>
        </div>
      </motion.div>
    </div>
  )
}
