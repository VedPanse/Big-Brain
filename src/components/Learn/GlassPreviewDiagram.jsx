import { motion } from 'framer-motion'
import { Hand, List, PenLine } from 'lucide-react'

const outputCards = [
  { title: 'Videos', icon: List, accent: 'from-sky-200/50 to-sky-100/20' },
  { title: 'Quizzes', icon: Hand, accent: 'from-emerald-200/50 to-emerald-100/20' },
  { title: 'Canvas', icon: PenLine, accent: 'from-amber-200/50 to-amber-100/20' },
]

export default function GlassPreviewDiagram() {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-slate-100 bg-white/70 px-6 py-8 shadow-[0_20px_60px_-45px_rgba(15,23,42,0.5)] md:px-10 md:py-10">
      <div className="pointer-events-none absolute -left-12 top-8 h-40 w-40 rounded-full bg-sky-200/30 blur-[90px]" />
      <div className="pointer-events-none absolute right-12 top-4 h-32 w-32 rounded-full bg-emerald-200/20 blur-[80px]" />

      <svg
        className="pointer-events-none absolute inset-0 hidden h-full w-full md:block"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
      >
        <defs>
          <marker
            id="arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="rgba(148,163,184,0.8)" />
          </marker>
        </defs>
        <line x1="16" y1="50" x2="42" y2="50" stroke="rgba(148,163,184,0.6)" strokeWidth="0.5" />
        <line
          x1="58"
          y1="34"
          x2="84"
          y2="26"
          stroke="rgba(148,163,184,0.6)"
          strokeWidth="0.5"
          markerEnd="url(#arrow)"
        />
        <line
          x1="58"
          y1="50"
          x2="84"
          y2="50"
          stroke="rgba(148,163,184,0.6)"
          strokeWidth="0.5"
          markerEnd="url(#arrow)"
        />
        <line
          x1="58"
          y1="66"
          x2="84"
          y2="74"
          stroke="rgba(148,163,184,0.6)"
          strokeWidth="0.5"
          markerEnd="url(#arrow)"
        />
      </svg>

      <div className="pointer-events-none absolute left-[54%] top-6 hidden -translate-x-1/2 text-xs font-medium text-slate-500 md:block">
        Watch
      </div>
      <div className="pointer-events-none absolute left-[56%] top-1/2 hidden -translate-x-1/2 -translate-y-1/2 text-xs font-medium text-slate-500 md:block">
        Practice
      </div>
      <div className="pointer-events-none absolute left-[54%] bottom-6 hidden -translate-x-1/2 text-xs font-medium text-slate-500 md:block">
        Draw
      </div>

      <div className="relative z-10 flex flex-col gap-8 md:min-h-[240px] md:flex-row md:items-center md:justify-between">
        <div className="flex items-center justify-center">
          <div className="rounded-full border border-slate-200 bg-white/70 px-5 py-3 text-sm font-medium text-slate-600 shadow-sm backdrop-blur">
            Topics
          </div>
        </div>

        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="relative mx-auto w-full max-w-sm rounded-[28px] border border-white/70 bg-white/60 p-6 shadow-[0_18px_40px_-28px_rgba(15,23,42,0.6)] backdrop-blur-xl"
        >
          <div className="pointer-events-none absolute -right-12 top-6 h-40 w-40 rounded-full bg-gradient-to-br from-sky-200/40 via-pink-200/30 to-emerald-200/30 blur-3xl" />
          <div className="relative">
            <div className="absolute -top-4 left-1 h-10 w-10 rounded-2xl bg-gradient-to-br from-slate-900/5 to-white/80 shadow-inner" />
            <div className="relative mt-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Big Brain
              </p>
              <p className="mt-2 text-base font-medium text-slate-700">
                Learner model adapts every next step.
              </p>
              <div className="mt-4 h-2 w-24 rounded-full bg-slate-200/80" />
              <div className="mt-2 h-2 w-36 rounded-full bg-slate-100" />
            </div>
          </div>
        </motion.div>

        <div className="grid gap-3">
          {outputCards.map((card, index) => {
            const Icon = card.icon
            return (
              <motion.div
                key={card.title}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + index * 0.12, duration: 0.5 }}
                className="group rounded-2xl border border-white/60 bg-white/70 px-4 py-3 shadow-sm backdrop-blur transition hover:-translate-y-0.5"
              >
                <div className="flex items-center gap-3">
                  <div className={`rounded-xl bg-gradient-to-br ${card.accent} p-2`}>
                    <Icon className="h-4 w-4 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-700">{card.title}</p>
                    <p className="text-xs text-slate-400">Tailored output</p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
