import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { AlertTriangle, BarChart2, RefreshCw } from 'lucide-react'
import { API_BASE } from '../config/api'

const preferenceKeys = ['diagram', 'equations', 'examples', 'step_by_step']

const InsightEmpty = () => (
  <p className="text-sm text-slate-500">
    Not enough data yet — complete a few problems to generate insights.
  </p>
)

function PreferenceBars({ preferences }) {
  return (
    <div className="space-y-3">
      {preferenceKeys.map((key) => (
        <div key={key}>
          <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
            <span className="capitalize">{key.replace('_', ' ')}</span>
            <span>{Math.round((preferences?.[key] || 0) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-slate-900"
              style={{ width: `${Math.round((preferences?.[key] || 0) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function CognitiveFingerprintPage() {
  const [data, setData] = useState(null)
  const [concepts, setConcepts] = useState([])
  const [loading, setLoading] = useState(true)
  const [conceptLoading, setConceptLoading] = useState(false)
  const [error, setError] = useState('')
  const [conceptError, setConceptError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BASE}/api/cognitive-fingerprint/summary`)
      if (!res.ok) throw new Error('Failed to load summary')
      const summary = await res.json()
      setData(summary)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchConcepts = async () => {
    setConceptLoading(true)
    setConceptError('')
    try {
      const res = await fetch(`${API_BASE}/api/cognitive-fingerprint/concepts?limit=20`)
      if (!res.ok) throw new Error('Concept endpoint unavailable')
      const list = await res.json()
      setConcepts(list || [])
    } catch (err) {
      setConceptError(err.message)
      setConcepts([])
    } finally {
      setConceptLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const insights = useMemo(() => data?.top_insights || [], [data])
  const errorHotspots = useMemo(
    () => (data?.error_hotspots || []).slice().sort((a, b) => (b.score || 0) - (a.score || 0)),
    [data],
  )

  const updatedAt = data?.updated_at
    ? new Date(data.updated_at).toLocaleString()
    : 'Not yet updated'

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Cognition Map
            </p>
            <h1 className="text-2xl font-semibold text-slate-900">Cognition Map</h1>
          </div>
          <Link to="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            Home
          </Link>
        </div>
      </div>

      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <div className="mb-4 flex items-center gap-3">
          <button
            onClick={fetchData}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <span className="text-xs text-slate-500">Last updated: {updatedAt}</span>
          {loading ? <span className="text-xs text-slate-500">Loading…</span> : null}
          {error ? (
            <span className="inline-flex items-center gap-2 text-xs font-semibold text-rose-600">
              <AlertTriangle size={14} />
              {error}
            </span>
          ) : null}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur"
          >
            <div className="text-sm font-semibold text-slate-700">Top Insights</div>
            <div className="mt-4 space-y-3">
              {insights.length ? (
                insights.map((insight) => (
                  <div
                    key={insight.id}
                    className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-800">{insight.title}</p>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Confidence {Math.round((insight.confidence || insight.confidence_0_1 || 0) * 100)}%
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{insight.evidence}</p>
                    {insight.suggested_intervention ? (
                      <p className="mt-1 text-xs font-semibold text-slate-700">
                        Intervention: {insight.suggested_intervention}
                      </p>
                    ) : null}
                  </div>
                ))
              ) : (
                <InsightEmpty />
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <BarChart2 size={18} />
              Learning Preferences
            </div>
            <div className="mt-4">
              <PreferenceBars preferences={data?.preferences || {}} />
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur"
        >
          <div className="text-sm font-semibold text-slate-700">Error Hotspots</div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {errorHotspots.length ? (
              errorHotspots.map((err) => (
                <div
                  key={err.error_type}
                  className="rounded-2xl border border-slate-200 bg-white/80 px-4 py-3"
                >
                  <p className="text-sm font-semibold text-slate-800">{err.error_type}</p>
                  <div className="mt-2 h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-slate-900"
                      style={{ width: `${Math.round((err.score || 0) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500">
                    Score {Math.round((err.score || 0) * 100)}%
                  </p>
                </div>
              ))
            ) : (
              <InsightEmpty />
            )}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 rounded-3xl border border-slate-200 bg-white/70 p-6 shadow-sm backdrop-blur"
        >
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">Weak Concepts Due</div>
            <button
              onClick={fetchConcepts}
              className="text-xs font-semibold text-slate-600 underline underline-offset-4"
            >
              View concept details
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {data?.weak_concepts_due?.length ? (
              data.weak_concepts_due.map((item) => (
                <div
                  key={item.concept_tag}
                  className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3"
                >
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                    <span>{item.concept_tag}</span>
                    <span className="text-xs text-slate-500">
                      Strength {Math.round((item.strength || 0) * 100)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">
                    Fragility {Math.round((item.fragility || 0) * 100)}% ·{' '}
                    {item.last_seen_at ? new Date(item.last_seen_at).toLocaleDateString() : 'N/A'}
                  </p>
                  <p className="text-xs text-slate-500">{item.due_reason}</p>
                </div>
              ))
            ) : (
              <InsightEmpty />
            )}
          </div>
          {conceptLoading ? (
            <p className="mt-3 text-xs text-slate-500">Loading concepts…</p>
          ) : null}
          {conceptError ? (
            <p className="mt-3 text-xs font-semibold text-rose-600">
              Concepts unavailable ({conceptError})
            </p>
          ) : null}
          {concepts.length ? (
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {concepts.map((c) => (
                <div
                  key={`${c.userId || ''}-${c.concept_tag || c.conceptTag}`}
                  className="rounded-2xl border border-slate-200 bg-white/70 px-4 py-3 text-xs"
                >
                  <div className="flex items-center justify-between text-sm font-semibold text-slate-800">
                    <span>{c.concept_tag || c.conceptTag}</span>
                    <span className="text-slate-500">{Math.round((c.strength || 0) * 100)}%</span>
                  </div>
                  <p className="text-slate-500">
                    Fragility {Math.round((c.fragility || 0) * 100)}% ·{' '}
                    {c.last_seen_at
                      ? new Date(c.last_seen_at).toLocaleDateString()
                      : c.last_seen_at === null
                        ? 'N/A'
                        : ''}
                  </p>
                  <p className="text-slate-500">
                    Exposures {c.exposures ?? c.exposures_count ?? '—'} · Success{' '}
                    {c.success_count ?? '—'} / Fail {c.fail_count ?? '—'}
                  </p>
                </div>
              ))}
            </div>
          ) : null}
        </motion.div>
      </div>
    </div>
  )
}
