import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">404</p>
        <h1 className="mt-2 text-xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">
          We couldn&apos;t find what you were looking for.
        </p>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => window.history.back()}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Go back
          </button>
          <Link to="/" className="text-sm font-semibold text-slate-600 hover:text-slate-900">
            Home
          </Link>
        </div>
      </div>
    </div>
  )
}
