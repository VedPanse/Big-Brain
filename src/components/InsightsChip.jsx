import { useEffect, useState } from 'react'
import { Lightbulb } from 'lucide-react'

export default function InsightsChip({ conceptTags = [] }) {
  const [insight, setInsight] = useState(null)

  useEffect(() => {
    const fetchInsight = async () => {
      try {
        const params = conceptTags.length ? `?concept_tags=${conceptTags.join(',')}` : ''
        const res = await fetch(`/api/cognitive-fingerprint/summary${params}`)
        if (!res.ok) return
        const data = await res.json()
        const candidate = data?.top_insights?.[0] || data?.error_hotspots?.[0]
        setInsight(candidate || null)
      } catch {
        // ignore
      }
    }
    fetchInsight()
  }, [conceptTags])

  if (!insight) return null

  return (
    <div className="flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
      <Lightbulb size={14} />
      <span>{insight.title || insight.error_type}</span>
      {insight.suggested_intervention ? (
        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">
          Try: {insight.suggested_intervention}
        </span>
      ) : null}
    </div>
  )
}
