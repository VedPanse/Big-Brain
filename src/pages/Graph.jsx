import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import GlassCard from '../components/GlassCard'
import NodePreview from '../components/NodePreview'
import PrimaryButton from '../components/PrimaryButton'
import ObsidianLearningGraph from '../components/ObsidianLearningGraph'
import { useLearning } from '../state/LearningContext'

export default function Graph({ embedded = false, forcePerformanceMode = false }) {
  const navigate = useNavigate()
  const { courseNodes, masteryMap, setCurrentNode, fingerprint } = useLearning()
  const [selected, setSelected] = useState(null)

  const recommended = useMemo(() => {
    return courseNodes.reduce((lowest, node) => {
      const score = masteryMap[node.title] ?? 0
      if (!lowest || score < lowest.score) return { node, score }
      return lowest
    }, null)
  }, [courseNodes, masteryMap])

  const handleOpen = (node) => {
    setCurrentNode(node.id)
    // Navigate to the course page for this topic
    navigate(`/course/${node.id}`)
  }

  const containerClass = embedded
    ? 'relative rounded-3xl border border-slate-100 bg-white/80 p-6 shadow-sm'
    : 'relative flex min-h-screen flex-col gap-6 px-6 py-10'

  const graphHeightClass = embedded ? 'h-[360px] md:h-[420px]' : 'h-[62vh]'
  const nodeSizeScale = embedded ? 0.85 : 1
  const fontScale = embedded ? 0.9 : 1

  return (
    <div className={containerClass}>
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Learning graph</p>
        <h2 className="text-3xl font-semibold text-slate-900">Your map of momentum</h2>
        <p className="text-sm text-slate-500">Weakest prerequisite chain is softly highlighted.</p>
      </div>

      <motion.div
        className={`relative w-full ${graphHeightClass}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <ObsidianLearningGraph
          nodes={courseNodes}
          masteryMap={masteryMap}
          forcePerformanceMode={forcePerformanceMode}
          nodeSizeScale={nodeSizeScale}
          fontScale={fontScale}
          showPerfToggle={!embedded}
          onSelect={(node) => setSelected(node)}
        />
      </motion.div>
      <br />

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
          <PrimaryButton 
            onClick={() => recommended?.node && handleOpen(recommended.node)} 
            disabled={!recommended?.node}
            className="w-full"
          >
            Continue recommended path
          </PrimaryButton>
          <p className="text-sm text-slate-500">
            {recommended?.node ? (
              <>
                Recommended: <span className="font-semibold text-slate-700">{recommended.node.title}</span> • {recommended.node.time}
              </>
            ) : (
              'Loading recommendations...'
            )}
          </p>
        </div>
      </div>

      {embedded ? (
        <div className="mt-6">
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
      ) : (
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
      )}
    </div>
  )
}
