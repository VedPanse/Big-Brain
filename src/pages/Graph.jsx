import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import NodePreview from '../components/NodePreview'
import PrimaryButton from '../components/PrimaryButton'
import { useLearning } from '../state/LearningContext'

const statusStyles = {
  mastered: 'bg-white/80 border-white/60 shadow-[0_0_18px_rgba(47,107,255,0.25)]',
  learning: 'bg-white/60 border-white/50 animate-pulse',
  fragile: 'bg-white/70 border-amber-200/60 shadow-[0_0_18px_rgba(251,191,36,0.25)]',
  weak: 'bg-white/40 border-white/40 opacity-70 blur-[0.2px]',
}

export default function Graph() {
  const navigate = useNavigate()
  const { courseNodes, masteryMap, setCurrentNode, fingerprint, learnerConceptState } = useLearning()
  const [selected, setSelected] = useState(null)

  const recommended = useMemo(() => {
    return courseNodes.reduce((lowest, node) => {
      const score = learnerConceptState?.[node.id]?.mastery ?? masteryMap[node.title] ?? 0
      if (!lowest || score < lowest.score) return { node, score }
      return lowest
    }, null)
  }, [courseNodes, learnerConceptState, masteryMap])

  const edges = useMemo(() => {
    return courseNodes.flatMap((node) =>
      node.prerequisites.map((pre) => {
        const from = courseNodes.find((n) => n.id === pre)
        return { from, to: node }
      }),
    )
  }, [courseNodes])

  const getStatus = (score, stability) => {
    if (score >= 0.7) return 'mastered'
    if (score < 0.45) return 'weak'
    if (stability < 0.5) return 'fragile'
    return 'learning'
  }

  const handleOpen = (node) => {
    setCurrentNode(node.id)
    navigate(`/canvas/${node.id}`)
  }

  return (
    <div className="relative flex min-h-screen flex-col gap-6 px-6 py-10">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Learning graph</p>
        <h2 className="text-3xl font-semibold text-slate-900">Your map of momentum</h2>
        <p className="text-sm text-slate-500">Weakest prerequisite chain is softly highlighted.</p>
      </div>

      <motion.div
        className="relative h-[62vh] w-full"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <svg className="absolute inset-0 h-full w-full">
          {edges.map((edge) => (
            <line
              key={`${edge.from?.id}-${edge.to.id}`}
              x1={`${edge.from?.x}%`}
              y1={`${edge.from?.y}%`}
              x2={`${edge.to.x}%`}
              y2={`${edge.to.y}%`}
              stroke="rgba(148, 163, 184, 0.4)"
              strokeWidth="1.5"
            />
          ))}
        </svg>
        {courseNodes.map((node) => {
          const concept = learnerConceptState?.[node.id]
          const score = concept?.mastery ?? masteryMap[node.title] ?? 0
          const stability = concept?.stability ?? 0.5
          const status = getStatus(score, stability)
          const isRecommended = recommended?.node.id === node.id
          return (
            <button
              key={node.id}
              onClick={() => setSelected(node)}
              className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-5 py-4 text-left transition hover:-translate-y-[55%] ${statusStyles[status]} ${
                isRecommended ? 'ring-2 ring-[color:var(--accent)]/30' : ''
              }`}
              style={{ left: `${node.x}%`, top: `${node.y}%` }}
            >
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{status}</p>
              <p className="text-lg font-semibold text-slate-800">{node.title}</p>
              <p className="text-xs text-slate-500">{Math.round(score * 100)}% mastery</p>
            </button>
          )
        })}
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <GlassCard className="space-y-3">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Cognitive fingerprint</p>
          <div className="flex flex-wrap gap-2">
            {(fingerprint.length ? fingerprint : ['Visual instinct', 'Pattern seeding']).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-white/50 bg-white/70 px-3 py-1 text-xs font-semibold text-slate-600"
              >
                {tag}
              </span>
            ))}
          </div>
        </GlassCard>
        <div className="flex flex-col items-start gap-3">
          <PrimaryButton onClick={() => handleOpen(recommended.node)} className="w-full">
            Continue recommended path
          </PrimaryButton>
          <p className="text-sm text-slate-500">
            Recommended: {recommended?.node.title} • {recommended?.node.time}
          </p>
        </div>
      </div>

      <div className="fixed bottom-8 right-8 z-30 w-full max-w-sm">
        <NodePreview
          node={selected}
          reason={
            selected
              ? `${selected.title} anchors the path from ${selected.prerequisites.length ? 'prerequisites' : 'intuition'} to mastery.`
              : ''
          }
          onOpen={() => selected && handleOpen(selected)}
        />
      </div>
    </div>
  )
}
