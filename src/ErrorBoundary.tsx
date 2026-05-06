import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  info: ErrorInfo | null
  resetting: boolean
  resetMessage: string | null
}

const STORAGE_KEY = 'clawy-notes-storage'
const IDB_NAME = 'plume'

/** Best-effort wipe of every persistence layer Plume touches. Used by the
 *  Reset-data fallback button so a corrupted note JSON can't trap users on
 *  the error screen. Returns once the IndexedDB delete actually resolves
 *  (or is blocked) so the subsequent reload doesn't race the deletion. */
async function wipeAllStorage(): Promise<void> {
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  if (typeof indexedDB === 'undefined') return
  await new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    try {
      const req = indexedDB.deleteDatabase(IDB_NAME)
      req.onsuccess = done
      req.onerror = done
      req.onblocked = done
      // Hard timeout in case the browser never fires any of the above
      // (Safari occasionally swallows them).
      setTimeout(done, 1500)
    } catch {
      done()
    }
  })
  if ('caches' in window) {
    try {
      const names = await caches.keys()
      await Promise.all(names.map((n) => caches.delete(n)))
    } catch {
      // ignore — caches are nice-to-have, the data wipe is what matters
    }
  }
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null, resetting: false, resetMessage: null }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in console for local debugging; no remote telemetry yet.
    console.error('Plume crashed:', error, info)
    this.setState({ info })
  }

  componentDidMount() {
    // URL escape hatch: visit `?reset=1` to wipe everything even when
    // the app keeps crashing before the fallback UI mounts. Lets users
    // recover from a corrupted JSON without opening DevTools.
    if (typeof window === 'undefined') return
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('reset') === '1') {
        this.setState({ resetting: true, resetMessage: 'Wiping local data…' })
        void wipeAllStorage().then(() => {
          // Strip the query string so reload doesn't loop the wipe.
          const url = window.location.origin + window.location.pathname
          window.location.replace(url)
        })
      }
    } catch {
      // ignore — non-critical
    }
  }

  reset = () => {
    this.setState({ error: null, info: null, resetMessage: null })
  }

  reload = () => {
    window.location.reload()
  }

  resetData = () => {
    const sure = window.confirm(
      'This will delete all notes, folders, and tags from this browser. Are you sure?',
    )
    if (!sure) return
    this.setState({ resetting: true, resetMessage: 'Wiping local data…' })
    void wipeAllStorage().then(() => {
      window.location.reload()
    })
  }

  render() {
    if (this.state.resetting) {
      return (
        <div
          role="status"
          className="min-h-screen flex items-center justify-center px-4 py-8 bg-[var(--bg-primary)] text-[var(--text-primary)]"
        >
          <p className="text-sm text-[var(--text-secondary)]">
            {this.state.resetMessage ?? 'Resetting…'}
          </p>
        </div>
      )
    }

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
            local data as a last resort. Stuck in a loop? Append{' '}
            <code className="px-1 py-0.5 rounded bg-[var(--bg-secondary)] text-xs font-mono">?reset=1</code>{' '}
            to the URL.
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
