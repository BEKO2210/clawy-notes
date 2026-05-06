import { useMemo } from 'react'
import { ListTree, ArrowLeft, FileText } from 'lucide-react'
import { useNoteStore } from './store'
import { extractOutline } from './lib'
import type { Note } from './types'

interface RightSidebarProps {
  note: Note
  onClose: () => void
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function RightSidebar({ note, onClose }: RightSidebarProps) {
  const { notes, setActiveNote } = useNoteStore()

  const outline = useMemo(() => extractOutline(note.content, 3), [note.content])

  const backlinks = useMemo(() => {
    if (!note.title) return []
    const re = new RegExp(`\\[\\[\\s*${escapeRegex(note.title)}\\s*\\]\\]`, 'i')
    return notes.filter(
      (n) => !n.isArchived && n.id !== note.id && re.test(n.content),
    )
  }, [notes, note.id, note.title])

  const handleOutlineClick = (text: string) => {
    window.dispatchEvent(
      new CustomEvent('clawy:scroll-to-heading', { detail: { text } }),
    )
  }

  return (
    <aside
      aria-label="Note inspector"
      className="hidden lg:flex flex-col w-64 h-screen border-l border-[var(--bg-tertiary)] bg-[var(--bg-secondary)] flex-shrink-0"
    >
      <header className="flex items-center justify-between px-3 py-2 border-b border-[var(--bg-tertiary)]">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <ListTree className="w-4 h-4" />
          <span className="text-xs font-semibold uppercase tracking-wide">Inspector</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Hide inspector"
          className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {/* Outline */}
        <section className="px-3 py-3 border-b border-[var(--bg-tertiary)]">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
            Outline
          </h3>
          {outline.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)] italic">
              No headings in this note.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {outline.map((entry, i) => (
                <li key={`${entry.line}-${i}`}>
                  <button
                    onClick={() => handleOutlineClick(entry.text)}
                    title={entry.text}
                    className="w-full text-left text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] rounded px-1.5 py-1 truncate transition-colors"
                    style={{ paddingLeft: `${(entry.level - 1) * 12 + 6}px` }}
                  >
                    {entry.text}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Backlinks */}
        <section className="px-3 py-3">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2 flex items-center gap-1">
            <span>Backlinks</span>
            <span className="text-[var(--text-tertiary)]">({backlinks.length})</span>
          </h3>
          {backlinks.length === 0 ? (
            <p className="text-xs text-[var(--text-tertiary)] italic">
              No notes link to this one yet. Use <code className="font-mono text-[10px]">[[{note.title}]]</code> elsewhere.
            </p>
          ) : (
            <ul className="space-y-1">
              {backlinks.map((b) => (
                <li key={b.id}>
                  <button
                    onClick={() => setActiveNote(b.id)}
                    className="w-full text-left flex items-start gap-2 px-1.5 py-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 mt-0.5 text-[var(--text-tertiary)] flex-shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-[var(--text-primary)] truncate">
                        {b.title}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </aside>
  )
}
