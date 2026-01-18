import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { topics } from '../data/topics'

const COURSE_STORAGE_KEY = 'bb-active-courses'

const normalizeCourseKey = (slug, customTopic) => {
  const normalizedTopic = (customTopic || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  return `${slug}::${normalizedTopic}`
}

export default function Learn() {
  const [query, setQuery] = useState('')
  const [activeCourses, setActiveCourses] = useState([])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(COURSE_STORAGE_KEY)
      const parsed = raw ? JSON.parse(raw) : []
      const list = Array.isArray(parsed) ? parsed : []
      const deduped = []
      const seen = new Set()
      list.forEach((course) => {
        const key = course?.key || normalizeCourseKey(course?.slug, course?.customTopic)
        if (!key || seen.has(key)) return
        seen.add(key)
        deduped.push({ ...course, key })
      })
      setActiveCourses(deduped)
    } catch {
      setActiveCourses([])
    }
  }, [])

  const filtered = useMemo(() => {
    const term = query.toLowerCase()
    if (!term) return topics
    return topics.filter((topic) => topic.title.toLowerCase().includes(term))
  }, [query])

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && query.trim()) {
      // Navigate to course page with the custom topic as a slug
      const customSlug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      window.location.href = `/course/${customSlug}?customTopic=${encodeURIComponent(query.trim())}`
    }
  }

  const handleRemoveCourse = (event, target) => {
    event.preventDefault()
    event.stopPropagation()
    const targetKey = target.key || normalizeCourseKey(target.slug, target.customTopic)
    const next = activeCourses.filter((course) => course.key !== targetKey)
    setActiveCourses(next)
    try {
      localStorage.setItem(COURSE_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // ignore storage errors
    }
  }

  const getCourseLink = (course) => {
    if (course.customTopic) {
      return `/course/${course.slug}?customTopic=${encodeURIComponent(course.customTopic)}`
    }
    return `/course/${course.slug}`
  }

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
          <div className="space-y-6">
            <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink md:text-5xl">
              What do you want to learn?
            </h1>
            <div className="relative w-full max-w-4xl lg:w-4/5">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search topics (e.g., derivatives, pointers, transformers) - Press Enter to search any topic"
                className="relative z-20 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base text-slate-700 outline-none transition focus:border-slate-300"
              />
              <img
                src="/logo.png"
                alt="Big Brain mascot"
                className="pointer-events-none absolute -right-5 top-0 z-10 w-32 -translate-y-1/2 rotate-[8deg] object-contain md:w-40"
              />
            </div>
          </div>
        </div>

        {filtered.length === 0 && query && (
          <div className="mt-12 rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
            <p className="text-lg text-slate-600">
              No predefined topics found. Press <kbd className="rounded bg-white px-2 py-1 text-sm font-semibold shadow-sm">Enter</kbd> to search videos for "{query}"
            </p>
          </div>
        )}

        <div className="mt-10 space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Your Courses
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">My courses</h2>
          </div>
          {activeCourses.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {activeCourses.map((course) => (
                <Link
                  key={`${course.slug}-${course.customTopic || 'default'}`}
                  to={getCourseLink(course)}
                  className="rounded-3xl border border-slate-100 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        Active
                      </p>
                      <h3 className="mt-3 text-lg font-semibold text-ink">{course.title}</h3>
                    </div>
                    <button
                      onClick={(event) => handleRemoveCourse(event, course)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-50"
                    >
                      Remove
                    </button>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-6 text-sm text-slate-600">
              You do not have any active courses yet.
            </div>
          )}
        </div>

        <div className="mt-12">
          <div className="border-t border-slate-100" />
          <div className="mt-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Recommendations
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Recommendations</h2>
          </div>
        </div>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
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
