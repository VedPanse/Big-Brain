import GlassCard from './GlassCard'
import PrimaryButton from './PrimaryButton'

export default function NodePreview({ node, reason, onOpen }) {
  if (!node) return null

  return (
    <GlassCard className="w-full max-w-sm space-y-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Why this was chosen</p>
        <h3 className="text-2xl font-semibold text-slate-900">{node.title}</h3>
      </div>
      <p className="text-sm text-slate-600">{reason}</p>
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>Estimated time</span>
        <span className="font-semibold text-slate-700">{node.time}</span>
      </div>
      <PrimaryButton onClick={onOpen} className="w-full">
        Open canvas
      </PrimaryButton>
    </GlassCard>
  )
}
