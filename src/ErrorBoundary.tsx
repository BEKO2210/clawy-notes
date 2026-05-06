import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in console for local debugging; no remote telemetry yet.
    console.error('Plume crashed:', error, info)
    this.setState({ info })
  }

  reset = () => {
    this.setState({ error: null, info: null })
  }

  reload = () => {
    window.location.reload()
  }

  resetData = () => {
    const sure = window.confirm(
      'This will delete all notes, folders, and tags from this browser. Are you sure?',
    )
    if (!sure) return
    try {
      window.localStorage.removeItem('clawy-notes-storage')
    } catch {
      // ignore — even if removal fails, reload may still recover
    }
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div
        role="alert"
        className="min-h-screen flex items-center justify-center px-4 py-8 bg-[var(--bg-primary)] text-[var(--text-primary)]"
      >
        <div className="max-w-md w-full">
          <div className="flex items-center gap-3 mb-4">
            <span
              aria-hidden
              className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10 text-red-500 text-xl"
            >
              !
            </span>
            <h1 className="text-xl font-display font-bold tracking-tight">
              Something broke
            </h1>
          </div>

          <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-5">
            Plume hit an unexpected error. Your notes are still saved locally.
            Try reloading first — if the error persists, you can reset the
            local data as a last resort.
          </p>

          <details className="mb-5 rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-secondary)] open:bg-[var(--bg-secondary)]">
            <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">
              Technical details
            </summary>
            <pre className="px-3 pb-3 text-[11px] font-mono whitespace-pre-wrap break-words text-[var(--text-tertiary)] overflow-x-auto">
{this.state.error.name}: {this.state.error.message}
{this.state.error.stack ?? ''}
            </pre>
          </details>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={this.reload}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all"
            >
              Reload
            </button>
            <button
              onClick={this.reset}
              className="px-4 py-2 rounded-lg border border-[var(--bg-tertiary)] text-sm font-medium hover:bg-[var(--bg-secondary)] active:scale-[0.98] transition-all"
            >
              Try again
            </button>
            <button
              onClick={this.resetData}
              className="px-4 py-2 rounded-lg border border-red-500/40 text-red-500 text-sm font-medium hover:bg-red-500/10 active:scale-[0.98] transition-all"
            >
              Reset data
            </button>
          </div>
        </div>
      </div>
    )
  }
}
