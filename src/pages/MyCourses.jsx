import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import NavBar from '../components/NavBar'

const COURSE_STORAGE_KEY = 'bb-active-courses'

const normalizeCourseKey = (slug, customTopic) => {
  const normalizedTopic = (customTopic || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  return `${slug}::${normalizedTopic}`
}

const titleize = (value) => {
  if (!value) return ''
  return value
    .split(' ')
    .map((word) => (word ? `${word[0].toUpperCase()}${word.slice(1)}` : ''))
    .join(' ')
}

export default function MyCourses() {
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
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">My courses</p>
            <h1 className="text-4xl font-semibold tracking-[-0.02em] text-ink md:text-5xl">
              Your learning shelf
            </h1>
            <p className="max-w-2xl text-base text-slate-500">
              Keep the focus tight. These are the courses shaping your next moves.
            </p>
          </div>
          <div className="px-2 py-2">
            <img
              src="/logo-smile.png"
              alt="Big Brain mascot"
              className="mascot-float h-32 w-32 object-contain opacity-90"
            />
          </div>
        </div>

        <div className="mt-12">
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
                        Active course
                      </p>
                      <h3 className="mt-3 text-lg font-semibold text-ink">
                        {titleize(course.title)}
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
      </motion.section>
    </div>
  )
}
