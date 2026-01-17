import clsx from 'clsx'

export default function SecondaryButton({ children, className = '', ...props }) {
  return (
    <button
      className={clsx(
        'secondary-btn hover:-translate-y-0.5 hover:bg-slate-50 active:translate-y-0 active:scale-[0.98]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
