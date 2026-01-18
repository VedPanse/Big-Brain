import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import PrimaryButton from '../components/PrimaryButton'
import SecondaryButton from '../components/SecondaryButton'

const steps = [
  {
    title: 'Choose a topic.',
    body: 'Pick a focus area and build a crisp plan for today.',
  },
  {
    title: 'Watch the best clips.',
    body: 'Short, curated videos tuned to your gaps.',
  },
  {
    title: 'Practice on canvas.',
    body: 'Work in a visual space that reveals your thinking.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 py-20"
      >
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
          <div className="max-w-3xl space-y-6">
            <h1 className="text-5xl font-semibold tracking-[-0.02em] text-ink md:text-7xl">Big Brain.</h1>
            <h2 className="text-3xl font-medium text-ash md:text-4xl">
              A learning OS that adapts to how you think.
            </h2>
            <p className="text-lg text-slate-600 md:text-xl">
              Videos → practice → canvas → mastery. A single flow that keeps you in motion and makes
              understanding visible.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link to="/learn">
                <PrimaryButton className="px-8 py-3.5 text-base">Start learning</PrimaryButton>
              </Link>
            </div>
          </div>
          <div className="flex items-center justify-center">
            <img
              src="/logo.png"
              alt="Big Brain logo"
              className="w-full max-w-xs object-contain mascot-excited"
            />
          </div>
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step.title} className="rounded-3xl border border-slate-100 bg-cloud p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Step {index + 1}
              </p>
              <h3 className="mt-4 text-xl font-semibold text-ink">{step.title}</h3>
              <p className="mt-3 text-base text-slate-600">{step.body}</p>
            </div>
          ))}
        </div>
        <div className="rounded-[32px] border border-slate-200 bg-white p-10 shadow-sm">
          <div className="grid gap-8 md:grid-cols-[1.2fr_1fr]">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Product preview
              </p>
              <h3 className="mt-4 text-3xl font-semibold text-ink">A focused course surface.</h3>
              <p className="mt-3 text-base text-slate-600">
                The course view blends curated videos, quick checks, and a canvas that captures your
                thinking. Everything you need in one clean layout.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Canvas</p>
                <p className="mt-3 text-sm text-slate-600">
                  Sketch a graph, label edges, and mark confusion points. The canvas stays live while you learn.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Teach-back</p>
                <p className="mt-3 text-sm text-slate-600">
                  Explain in your own words and get precise prompts where reasoning breaks down.
                </p>
              </div>
            </div>
          </div>
        </div>
      </motion.section>
      <footer className="border-t border-slate-100 py-8">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 text-sm text-slate-500">
          <span>© 2025 Big Brain</span>
          <span>Built for focused learning.</span>
        </div>
      </footer>
    </div>
  )
}
