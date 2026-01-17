import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { topics } from '../data/topics'

export default function Learn() {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const term = query.toLowerCase()
    if (!term) return topics
    return topics.filter((topic) => topic.title.toLowerCase().includes(term))
  }, [query])

  return (
    <div className="min-h-screen bg-white">
      <NavBar />
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 18 }}
        className="mx-auto w-full max-w-6xl px-6 py-16"
      >
        <div className="space-y-6">
          <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink md:text-5xl">
            What do you want to learn?
          </h1>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search topics (e.g., derivatives, pointers, transformers)"
            className="w-full rounded-2xl border border-slate-200 px-5 py-4 text-base text-slate-700 outline-none transition focus:border-slate-300"
          />
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {filtered.map((topic) => (
            <Link key={topic.slug} to={`/course/${topic.slug}`}>
              <div className="group rounded-3xl border border-slate-100 bg-cloud p-6 transition hover:-translate-y-1 hover:shadow-lift">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  {topic.title}
                </p>
                <h3 className="mt-4 text-xl font-semibold text-ink">{topic.summary}</h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {topic.modules.map((module) => (
                    <span
                      key={module}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-500"
                    >
                      {module}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </motion.section>
    </div>
  )
}
