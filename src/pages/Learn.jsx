import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link, useNavigate } from 'react-router-dom'
import NavBar from '../components/NavBar'
import { topics } from '../data/topics'
import { useLearning } from '../state/LearningContext'

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
  const { learnerConceptState, prereqEdges, refreshLearnerProfile } = useLearning()
  const [query, setQuery] = useState('')
  const [activeCourses, setActiveCourses] = useState([])
  const [courseRecommendations, setCourseRecommendations] = useState([])
  const [remoteSuggestions, setRemoteSuggestions] = useState([])
  const [expandedWhy, setExpandedWhy] = useState(null)

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
    refreshLearnerProfile().catch(() => {})
  }, [refreshLearnerProfile])

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const response = await fetch('/api/recommendations/course')
        if (!response.ok) {
          const message = await response.json().catch(() => ({}))
          throw new Error(message.error || 'Unable to load recommendations.')
        }
        const data = await response.json()
        const list = Array.isArray(data.recommendations) ? data.recommendations : []
        setCourseRecommendations(list)
      } catch {
        setCourseRecommendations([])
      }
    }

    fetchRecommendations()
  }, [])

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

  const titleize = (value) => {
    if (!value) return ''
    return value
      .split(' ')
      .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1)}` : ''))
      .join(' ')
  }

  const normalizeTitle = (value) => titleize(value.replace(/-/g, ' '))

  const getConceptName = (id) => {
    return learnerConceptState?.[id]?.name || titleize(String(id || '').replace(/-/g, ' '))
  }

  const getCoursePrereqs = (conceptIds) => {
    const set = new Set(conceptIds || [])
    const prereqs = (prereqEdges || [])
      .filter((edge) => set.has(edge.to) && set.has(edge.from))
      .map((edge) => edge.from)
    return prereqs.length ? prereqs : Array.from(set)
  }

  const getBlockingConcepts = (conceptIds) => {
    const prereqs = getCoursePrereqs(conceptIds)
    const scored = prereqs.map((id) => ({
      id,
      mastery: learnerConceptState?.[id]?.mastery ?? 0.4,
    }))
    return scored
      .filter((item) => item.mastery < 0.5)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, 3)
  }

  const getReadinessStyles = (readiness) => {
    if (readiness === 'Ready') return 'bg-green-100 text-green-700'
    if (readiness === 'Needs Prep') return 'bg-amber-100 text-amber-700'
    return 'bg-rose-100 text-rose-700'
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
                onKeyDown={handleKeyDown}
                placeholder="Search topics (e.g., derivatives, pointers, transformers) - Press Enter to search any topic"
                className="relative z-20 w-full rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base text-slate-700 outline-none transition focus:border-slate-300"
              />
              <img
                src={query.trim() ? '/logo-smile.png' : '/logo.png'}
                alt="Big Brain mascot"
                className={`pointer-events-none absolute -right-5 top-0 z-10 w-32 -translate-y-1/2 object-contain transition-transform duration-500 ease-out md:w-40 ${
                  query.trim() ? 'rotate-[12deg] -translate-x-1 -translate-y-[60%]' : 'rotate-[8deg]'
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
                      <h3 className="mt-3 text-lg font-semibold text-ink">
                        {normalizeTitle(course.title)}
                      </h3>
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

        {courseRecommendations.length > 0 && (
          <div className="mt-12">
            <div className="border-t border-slate-100" />
            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Personalized
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Recommended for you</h2>
            </div>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {[...courseRecommendations]
                .sort((a, b) => b.recommendation_score - a.recommendation_score)
                .map((course) => {
                  const blocking = getBlockingConcepts(course.course_concepts || [])
                  return (
                    <Link key={course.courseId} to={`/course/${course.slug}`}>
                      <div className="group rounded-3xl border border-slate-100 bg-cloud p-6 transition hover:-translate-y-1 hover:shadow-lift">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                            Recommended
                          </p>
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${getReadinessStyles(
                              course.readiness,
                            )}`}
                          >
                            {course.readiness}
                          </span>
                        </div>
                        <h3 className="mt-4 text-xl font-semibold text-ink">{course.title}</h3>
                        <div className="mt-3 space-y-2 text-sm text-slate-500">
                          {(course.reasons_json || []).map((reason) => (
                            <p key={reason}>• {reason}</p>
                          ))}
                        </div>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.preventDefault()
                            setExpandedWhy((prev) => (prev === course.courseId ? null : course.courseId))
                          }}
                          className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400 hover:text-slate-600"
                        >
                          Why?
                        </button>
                        {expandedWhy === course.courseId && (
                          <div className="mt-3 rounded-2xl border border-slate-100 bg-white p-3 text-xs text-slate-600">
                            <p>Readiness: {course.readiness}</p>
                            <p>Risk: {Math.round((course.risk || 0) * 100)}%</p>
                            <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                              Blocking concepts
                            </p>
                            <div className="mt-1 flex flex-wrap gap-2">
                              {blocking.length ? (
                                blocking.map((concept) => (
                                  <span
                                    key={concept.id}
                                    className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-semibold text-slate-500"
                                  >
                                    {getConceptName(concept.id)}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] text-slate-400">No blockers detected</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
            </div>
          </div>
        )}

        {(filtered.length > 0 || query.trim()) && (
          <div className="mt-12">
            <div className="border-t border-slate-100" />
            <div className="mt-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Browse
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Topics</h2>
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
          </div>
        )}
      </motion.section>
    </div>
  )
}
