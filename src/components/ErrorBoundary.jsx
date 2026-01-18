import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error('Graph error boundary caught:', {
      message: error?.message,
      stack: error?.stack,
      componentStack: info?.componentStack,
    })
  }

  handleReset = (mode) => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.(mode)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-center text-slate-700">
          <p className="text-base font-semibold text-ink">Graph failed to render</p>
          <p className="text-sm text-slate-500">Try again or switch to Performance Mode.</p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => this.handleReset('normal')}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => this.handleReset('performance')}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Performance Mode
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
