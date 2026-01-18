import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { topics } from '../data/topics'
import ErrorBoundary from '../components/ErrorBoundary'

const Graph = lazy(() => import('./Graph'))

const COURSE_STORAGE_KEY = 'bb-active-courses'

const normalizeCourseKey = (slug, customTopic) => {
  const normalizedTopic = (customTopic || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  return `${slug}::${normalizedTopic}`
}

export default function Learn() {
  const navigate = useNavigate()
  const [graphKey, setGraphKey] = useState(0)
  const [forcePerfMode, setForcePerfMode] = useState(false)
  const [query, setQuery] = useState('')
  const [activeCourses, setActiveCourses] = useState([])
  const [recommendations, setRecommendations] = useState([])
  const [remoteSuggestions, setRemoteSuggestions] = useState([])

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

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (!activeCourses.length) {
        setRecommendations([])
        return
      }
      try {
        const response = await fetch('/api/recommendations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            courses: activeCourses.map((course) => ({
              title: normalizeTitle(course.title),
            })),
            count: 6,
          }),
        })
        if (!response.ok) {
          const message = await response.json().catch(() => ({}))
          throw new Error(message.error || 'Unable to load recommendations.')
        }
        const data = await response.json()
        setRecommendations(Array.isArray(data.recommendations) ? data.recommendations : [])
      } catch {
        setRecommendations([])
      }
    }

    fetchRecommendations()
  }, [activeCourses])

  const filtered = useMemo(() => {
    const term = query.toLowerCase()
    if (!term) return topics
    return topics.filter((topic) => topic.title.toLowerCase().includes(term))
  }, [query])

  const suggestions = useMemo(() => {
    if (remoteSuggestions.length) return remoteSuggestions
    const term = query.trim().toLowerCase()
    if (!term) return []
    const candidates = topics.filter((topic) => {
      return (
        topic.title.toLowerCase().includes(term) ||
        topic.slug.toLowerCase().includes(term) ||
        topic.modules?.some((module) => module.toLowerCase().includes(term))
      )
    })
    return candidates.map((topic) => topic.title).slice(0, 6)
  }, [query, remoteSuggestions])

  const handleKeyDown = (event) => {
    if (event.key !== 'Enter' || !query.trim()) return
    if (suggestions.length > 0) {
      const first = suggestions[0]
      const title = typeof first === 'string' ? normalizeTitle(first) : normalizeTitle(first.title)
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      navigate(`/course/${slug}?customTopic=${encodeURIComponent(title)}`)
      return
    }
    const customSlug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    navigate(`/course/${customSlug}?customTopic=${encodeURIComponent(query.trim())}`)
  }

  useEffect(() => {
    const term = query.trim()
    if (!term) {
      setRemoteSuggestions([])
      return
    }
    const timer = setTimeout(() => {
      fetch('/api/autocomplete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: term, count: 6 }),
      })
        .then((response) => response.json())
        .then((data) => {
          const list = Array.isArray(data.suggestions) ? data.suggestions : []
          setRemoteSuggestions(list.map((item) => normalizeTitle(String(item))))
        })
        .catch(() => {
          setRemoteSuggestions([])
        })
    }, 250)
    return () => clearTimeout(timer)
  }, [query])

  const titleize = (value) => {
    if (!value) return ''
    return value
      .split(' ')
      .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1)}` : ''))
      .join(' ')
  }

  const normalizeTitle = (value) => titleize(value.replace(/-/g, ' '))

  const GraphSkeleton = () => (
    <div className="relative h-[360px] md:h-[420px] w-full overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-500">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-slate-500" />
        <p className="text-sm font-semibold text-slate-700">Building your map…</p>
        <p className="text-xs text-slate-500">Loading data…</p>
      </div>
    </div>
  )

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
                onKeyDown={handleKeyDown}
                placeholder="Search topics (e.g., derivatives, pointers, transformers) - Press Enter to search any topic"
                className="relative z-20 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base text-slate-700 outline-none transition focus:border-slate-300"
              />
              <img
                src="/logo.png"
                alt="Big Brain mascot"
                className={`pointer-events-none absolute -right-5 top-0 z-10 w-32 -translate-y-1/2 object-contain transition-opacity duration-300 ease-out md:w-40 ${
                  query.trim() ? 'opacity-0' : 'opacity-100'
                }`}
              />
              <img
                src="/logo-smile.png"
                alt="Big Brain mascot smiling"
                className={`pointer-events-none absolute -right-5 top-0 z-10 w-32 -translate-y-1/2 object-contain transition-transform duration-500 ease-out md:w-40 ${
                  query.trim()
                    ? 'opacity-100 rotate-[12deg] -translate-x-1 -translate-y-[70%]'
                    : 'opacity-0 rotate-[8deg]'
                }`}
              />
              {suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
                  {suggestions.map((topic) => {
                    const title = typeof topic === 'string' ? normalizeTitle(topic) : normalizeTitle(topic.title)
                    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    return (
                    <button
                      key={slug}
                      onClick={() => navigate(`/course/${slug}?customTopic=${encodeURIComponent(title)}`)}
                      className="flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <span className="font-semibold text-ink">{title}</span>
                      <span className="text-xs text-slate-400">Suggested</span>
                    </button>
                  )})}
                </div>
              )}
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

        {(recommendations.length > 0 || query.trim()) && (
          <>
            <div className="mt-12">
              <div className="border-t border-slate-100" />
              <div className="mt-8">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Recommendations
                </p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">
                  {recommendations.length > 0 ? 'Recommendations' : 'Topics'}
                </h2>
              </div>
            </div>

            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {(recommendations.length ? recommendations : filtered.map((topic) => topic.title)).map(
                (item) => {
                  if (recommendations.length) {
                    const title = normalizeTitle(String(item))
                    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
                    return (
                      <Link key={slug} to={`/course/${slug}?customTopic=${encodeURIComponent(title)}`}>
                        <div className="group rounded-3xl border border-slate-100 bg-cloud p-6 transition hover:-translate-y-1 hover:shadow-lift">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Suggested
                          </p>
                          <h3 className="mt-4 text-xl font-semibold text-ink">{title}</h3>
                          <p className="mt-3 text-sm text-slate-500">Built from your current courses.</p>
                        </div>
                      </Link>
                    )
                  }
                  const topic = topics.find((topic) => topic.title === item)
                  if (!topic) return null
                  return (
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
                  )
                },
              )}
            </div>

            <div className="mt-12">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Knowledge graph
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Your learning map</h2>
              <div className="mt-6">
                <ErrorBoundary
                  onReset={(mode) => {
                    setGraphKey((k) => k + 1)
                    setForcePerfMode(mode === 'performance')
                  }}
                >
                  <Suspense fallback={<GraphSkeleton />}>
                    <Graph key={graphKey} embedded forcePerformanceMode={forcePerfMode} />
                  </Suspense>
                </ErrorBoundary>
              </div>
            </div>
          </>
        )}
      </motion.section>
    </div>
  )
}
