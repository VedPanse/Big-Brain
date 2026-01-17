import clsx from 'clsx'

export default function PrimaryButton({ children, className = '', ...props }) {
  return (
    <button
      className={clsx(
        'primary-btn hover:-translate-y-0.5 hover:shadow-lift active:translate-y-0 active:scale-[0.98]',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
