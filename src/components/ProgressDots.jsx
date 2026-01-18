import clsx from 'clsx'

export default function ProgressDots({ total, current }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }).map((_, index) => {
        const active = index === current
        return (
          <span
            key={`dot-${index}`}
            className={clsx(
              'h-2.5 w-2.5 rounded-full transition',
              active ? 'bg-[color:var(--accent)] shadow-sm' : 'bg-slate-200',
            )}
          />
        )
      })}
    </div>
  )
}
