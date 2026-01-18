import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import GlassCard from '../components/GlassCard'
import PrimaryButton from '../components/PrimaryButton'

export default function Onboarding() {
  const navigate = useNavigate()
  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 110, damping: 18 }}
        className="w-full max-w-lg"
      >
        <GlassCard className="space-y-6 text-center">
          <div className="space-y-3">
            <p className="text-xs uppercase tracking-[0.4em] text-slate-400">Welcome</p>
            <h1 className="text-4xl font-semibold text-slate-900">Big Brain</h1>
            <p className="text-base text-slate-600">Let&apos;s understand how you think.</p>
          </div>
          <div className="flex flex-col items-center gap-3">
            <PrimaryButton className="w-full" onClick={() => navigate('/diagnostic')}>
              Start diagnostic
            </PrimaryButton>
            <button
              onClick={() => navigate('/learn')}
              className="text-sm font-semibold text-slate-400 transition hover:text-slate-600"
            >
              Skip
            </button>
          </div>
        </GlassCard>
      </motion.div>
    </div>
  )
}
