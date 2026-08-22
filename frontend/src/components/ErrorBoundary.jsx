import React from 'react'
import { Link } from 'react-router-dom'

/**
 * ErrorBoundary — catches render-time errors and shows a friendly fallback
 * instead of a blank white page.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log to an external error-reporting service in production
    console.error('[Dayflow] Render error:', error, info?.componentStack)
  }

  reset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex items-center justify-center p-6">
          <div className="card card-body max-w-lg text-center space-y-4">
            <div className="mx-auto w-16 h-16 rounded-2xl bg-danger-600/10 text-danger-600 grid place-items-center text-4xl">
              ⚠️
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Something went wrong</h2>
            <p className="text-sm text-slate-600">
              An unexpected error occurred while rendering this page.
            </p>
            {this.state.error && (
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-left">
                <div className="text-xs font-semibold text-slate-500 mb-1">Error details</div>
                <pre className="text-xs text-danger-600 whitespace-pre-wrap break-words max-h-40 overflow-auto">
                  {this.state.error.message}
                </pre>
              </div>
            )}
            <div className="flex items-center justify-center gap-3 pt-2">
              <button onClick={this.reset} className="btn-primary">
                Try again
              </button>
              <Link to="/dashboard" className="btn-outline">
                Go to Dashboard
              </Link>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
