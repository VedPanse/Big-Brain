import { Link, useLocation } from 'react-router-dom'
import PrimaryButton from './PrimaryButton'

const links = [
  { label: 'Learn', to: '/learn', match: '/learn' },
  { label: 'Canvas', to: '/canvas/calculus', match: '/canvas' },
]

export default function NavBar() {
  const location = useLocation()

  return (
    <div className="sticky top-0 z-40 w-full border-b border-slate-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-lg font-semibold text-ink">
          Big Brain
        </Link>
        <div className="hidden items-center gap-8 text-sm text-slate-500 md:flex">
          {links.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={`transition hover:text-ink ${location.pathname.startsWith(link.match) ? 'text-ink' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <Link to="/learn">
          <PrimaryButton>Start learning</PrimaryButton>
        </Link>
      </div>
    </div>
  )
}
