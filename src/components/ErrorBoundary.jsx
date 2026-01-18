import { Component } from 'react'
import { Link } from 'react-router-dom'

const isDev = import.meta.env?.MODE !== 'production'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    if (isDev) {
      // eslint-disable-next-line no-console
      console.error('ErrorBoundary caught', error, info)
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
              Something crashed on this page
            </p>
            <h1 className="mt-2 text-xl font-semibold text-slate-900">We hit a snag.</h1>
            {isDev && this.state.error ? (
              <p className="mt-2 rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                {this.state.error?.message}
              </p>
            ) : null}
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Go back
              </button>
              <Link
                to="/"
                onClick={this.handleReset}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900"
              >
                Home
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
