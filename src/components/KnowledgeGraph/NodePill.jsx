import { motion } from 'framer-motion'

const statusStyles = {
  mastered: { dot: 'bg-emerald-400', ring: '#10b981' },
  progress: { dot: 'bg-sky-400', ring: '#38bdf8' },
  weak: { dot: 'bg-amber-400', ring: '#f59e0b' },
  locked: { dot: 'bg-slate-300', ring: '#cbd5f5' },
}

const LockIcon = () => (
  <svg
    viewBox="0 0 16 16"
    className="h-3 w-3 text-slate-400"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.5"
  >
    <rect x="3.2" y="7" width="9.6" height="6.5" rx="1.4" />
    <path d="M5.2 7V5.3a2.8 2.8 0 0 1 5.6 0V7" />
  </svg>
)

export default function NodePill({ node, isSelected, isDimmed, isLocked, isSearchMatch, onSelect }) {
  const effectiveStatus = isLocked ? 'locked' : node.status
  const status = statusStyles[effectiveStatus] || statusStyles.locked
  const ringValue = Math.round(node.mastery * 100)
  const ringStyle = {
    background: `conic-gradient(${status.ring} ${ringValue}%, rgba(15,23,42,0.08) 0)`,
  }

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(node)}
      whileHover={{ y: -2 }}
      className={`group relative flex w-[176px] items-center gap-3 rounded-full border px-4 py-2 text-sm font-medium text-slate-700 transition ${
        isSelected
          ? 'border-sky-300 shadow-[0_0_0_1px_rgba(56,189,248,0.15)]'
          : isSearchMatch
            ? 'border-black/20 shadow-[0_0_0_1px_rgba(15,23,42,0.08)]'
            : 'border-black/10'
      } ${isDimmed ? 'opacity-35' : 'opacity-100'}`}
      data-node
    >
      <span className={`h-2.5 w-2.5 rounded-full ${status.dot}`} />
      <span className="flex-1 text-left">{node.title}</span>
      <span className="relative h-5 w-5 rounded-full p-[2px]" style={ringStyle}>
        <span className="block h-full w-full rounded-full bg-white" />
      </span>
      {effectiveStatus === 'progress' && (
        <motion.span
          className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-sky-200/60"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity }}
        />
      )}
      {isLocked && (
        <span className="absolute -bottom-5 left-3 flex items-center gap-1 text-[10px] uppercase tracking-[0.3em] text-slate-300 opacity-0 transition group-hover:opacity-100">
          <LockIcon />
          Locked
        </span>
      )}
    </motion.button>
  )
}
