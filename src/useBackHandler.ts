import { useEffect, useRef } from 'react'

/**
 * Back-button trap. Treats a piece of UI state as a navigation level so the
 * Android system back button, iOS swipe-back gesture and the desktop
 * browser back button close the open overlay instead of leaving the
 * whole page.
 *
 * Multiple overlays stack in the order they were activated; the most
 * recently opened closes first. Programmatic dismiss (X button, outside
 * click, Cancel) cleans up its own history entry so the back button
 * still works as a one-step undo afterwards.
 */

interface Entry {
  id: number
  close: () => void
}

const stack: Entry[] = []
let nextId = 1
let suppressNextPop = false
let listenerInstalled = false

function ensureListener(): void {
  if (listenerInstalled || typeof window === 'undefined') return
  listenerInstalled = true
  window.addEventListener('popstate', () => {
    // Programmatic close just popped its own history entry — eat the
    // resulting popstate so we don't double-close the next overlay.
    if (suppressNextPop) {
      suppressNextPop = false
      return
    }
    const entry = stack.pop()
    if (entry) entry.close()
  })
}

export function useBackHandler(active: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose)
  // Keep the ref in sync with the latest onClose without writing during
  // render — the rule-of-hooks linter rightly flags that.
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!active || typeof window === 'undefined') return
    ensureListener()
    const id = nextId++
    stack.push({ id, close: () => closeRef.current() })
    try {
      window.history.pushState({ plumeBack: id }, '')
    } catch {
      // History API unavailable (e.g. sandboxed iframe). Quietly degrade
      // — the rest of the app still works, just without the back-trap.
    }

    return () => {
      const idx = stack.findIndex((e) => e.id === id)
      if (idx === -1) {
        // popstate already removed our entry; the browser is already
        // one step back so we don't have to do anything.
        return
      }
      const wasTop = idx === stack.length - 1
      stack.splice(idx, 1)
      if (wasTop) {
        // Programmatic close on the top-most entry — pop our history
        // entry too. Suppress the resulting popstate so the listener
        // doesn't think the user pressed back again.
        suppressNextPop = true
        try {
          window.history.back()
        } catch {
          suppressNextPop = false
        }
      }
      // Out-of-order close (rare; would mean an obscured overlay
      // dismissed itself) leaves a stale history entry. We accept that
      // — the user will just need one extra back press.
    }
  }, [active])
}

// Test-only: lets the unit test reset module-level state between cases.
export function __resetBackHandlerForTests(): void {
  stack.length = 0
  nextId = 1
  suppressNextPop = false
}
