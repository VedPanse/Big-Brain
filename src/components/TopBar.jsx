import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

export default function TopBar({ title, subtitle }) {
  return (
    <div className="flex items-center justify-between px-6 py-4">
      <div>
        <p className="text-sm uppercase tracking-[0.2em] text-slate-400">{subtitle}</p>
        <h2 className="text-2xl font-semibold text-slate-900">{title}</h2>
      </div>
      <Link
        to="/learn"
        className="flex items-center gap-2 rounded-full border border-white/40 bg-white/70 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5"
      >
        <ArrowLeft size={16} />
        Exit to learn
      </Link>
    </div>
  )
}
