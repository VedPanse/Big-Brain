import clsx from 'clsx'

export default function GlassCard({ children, className = '' }) {
  return (
    <div className={clsx('glass-card px-8 py-8 transition hover:shadow-lift', className)}>
      {children}
    </div>
  )
}
