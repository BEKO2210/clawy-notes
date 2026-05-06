import { useEffect, useRef, type ReactNode } from 'react'

/**
 * Responsive picker container.
 * - On <sm screens: renders as a bottom sheet (fixed at bottom, full width,
 *   rounded top corners, slide-up entrance, tappable backdrop).
 * - On sm+: renders as a dropdown anchored to the parent (absolute,
 *   right-aligned, scale-in entrance, no backdrop).
 *
 * The parent component is responsible for the trigger button and for
 * managing the `open` boolean. Outside-click and Esc handling live here.
 */
interface PickerProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** Optional maxWidth on desktop — defaults to w-56 (224px). */
  desktopWidthClass?: string
}

export function Picker({
  open,
  onClose,
  title,
  children,
  desktopWidthClass = 'sm:w-56',
}: PickerProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    const onClick = (e: MouseEvent) => {
      if (!sheetRef.current) return
      if (sheetRef.current.contains(e.target as Node)) return
      onClose()
    }
    document.addEventListener('keydown', onKey)
    // Use `mousedown` so a tap on the backdrop registers before any other
    // bubbling click handlers fire on the children.
    document.addEventListener('mousedown', onClick)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onClick)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <>
      {/* Mobile-only backdrop */}
      <div
        aria-hidden
        className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm sm:hidden"
        onClick={onClose}
      />
      <div
        ref={sheetRef}
        role="menu"
        aria-label={title}
        className={[
          'z-40 bg-[var(--bg-secondary)] shadow-2xl',
          // Mobile: bottom sheet
          'fixed inset-x-0 bottom-0 max-h-[70vh]',
          'rounded-t-2xl border-t border-[var(--bg-tertiary)]',
          'animate-slide-up',
          'pb-[env(safe-area-inset-bottom)]',
          // Desktop: dropdown anchored to button
          'sm:absolute sm:inset-x-auto sm:bottom-auto sm:top-full sm:right-0 sm:mt-1',
          'sm:rounded-lg sm:border sm:max-h-64 sm:animate-scale-in',
          desktopWidthClass,
          // Common
          'overflow-y-auto p-1.5 scrollbar-thin',
        ].join(' ')}
      >
        {/* Mobile sheet handle */}
        <div className="sm:hidden flex justify-center pt-1.5 pb-2" aria-hidden>
          <span className="block w-10 h-1 rounded-full bg-[var(--bg-tertiary)]" />
        </div>
        {title && (
          <p className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            {title}
          </p>
        )}
        {children}
      </div>
    </>
  )
}
