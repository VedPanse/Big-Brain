import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const getStatus = (node) => {
  if (!node) return { label: 'Unknown', classes: 'border-slate-200 bg-slate-50 text-slate-500' }
  if (node.needsReview) {
    return { label: 'Needs Review', classes: 'border-amber-200 bg-amber-50 text-amber-700' }
  }
  if (node.effectiveStrength >= 0.7) {
    return { label: 'Strong', classes: 'border-sky-200 bg-sky-50 text-sky-700' }
  }
  if (node.effectiveStrength >= 0.4) {
    return { label: 'Steady', classes: 'border-blue-200 bg-blue-50 text-blue-700' }
  }
  return { label: 'Weak', classes: 'border-slate-200 bg-slate-50 text-slate-500' }
}

export default function ConceptSheet({
  node,
  parentTopic,
  connections = [],
  onClose,
  onPrimary,
  onSelectRelated,
}) {
  useEffect(() => {
    const handleKey = (event) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const status = getStatus(node)

  return (
    <AnimatePresence>
      {node && (
        <motion.div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ type: 'spring', stiffness: 140, damping: 18 }}
            className="absolute right-6 top-24 hidden w-[360px] rounded-3xl border border-slate-200 bg-white p-6 text-slate-700 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.2)] md:block"
            onClick={(event) => event.stopPropagation()}
          >
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${status.classes}`}
            >
              {status.label}
            </span>
            <h3 className="mt-4 text-2xl font-semibold text-slate-900">{node.label}</h3>
            {node.type === 'concept' && parentTopic && (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Topic: {parentTopic.label}
              </p>
            )}
            <p className="mt-3 text-sm text-slate-500">
              Strength {(node.effectiveStrength * 100).toFixed(0)}% · {node.exposures || 0} exposures
            </p>

            <div className="mt-6 space-y-3 text-sm text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Connections
              </p>
              <div className="flex flex-wrap gap-2">
                {connections.length ? (
                  connections.map((item) => (
                    <button
                      key={item.node.id}
                      onClick={() => onSelectRelated(item.node)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                      title={item.reason || 'Related'}
                    >
                      {item.node.label}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">No links yet.</span>
                )}
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => onPrimary(node)}
                className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Open course
              </button>
            </div>
          </motion.aside>

          <motion.aside
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ type: 'spring', stiffness: 140, damping: 18 }}
            className="absolute bottom-4 left-4 right-4 rounded-3xl border border-slate-200 bg-white p-5 text-slate-700 shadow-[0_24px_50px_-40px_rgba(15,23,42,0.2)] md:hidden"
            onClick={(event) => event.stopPropagation()}
          >
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] ${status.classes}`}
            >
              {status.label}
            </span>
            <h3 className="mt-3 text-xl font-semibold text-slate-900">{node.label}</h3>
            {node.type === 'concept' && parentTopic && (
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Topic: {parentTopic.label}
              </p>
            )}
            <p className="mt-2 text-sm text-slate-500">
              Strength {(node.effectiveStrength * 100).toFixed(0)}% · {node.exposures || 0} exposures
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                Connections
              </p>
              <div className="flex flex-wrap gap-2">
                {connections.length ? (
                  connections.map((item) => (
                    <button
                      key={item.node.id}
                      onClick={() => onSelectRelated(item.node)}
                      className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600"
                      title={item.reason || 'Related'}
                    >
                      {item.node.label}
                    </button>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">No links yet.</span>
                )}
              </div>
            </div>
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => onPrimary(node)}
                className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
              >
                Open course
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
