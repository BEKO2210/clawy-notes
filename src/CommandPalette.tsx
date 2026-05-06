import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FileText, Plus, Sun, Moon, Settings as SettingsIcon, Archive,
  Pin, Search, Tag as TagIcon, FlaskConical, Trash2,
} from 'lucide-react'
import { useNoteStore } from './store'
import type { Note } from './types'

interface Action {
  id: string
  label: string
  hint?: string
  icon: React.ReactNode
  run: () => void
}

interface NoteItem {
  type: 'note'
  note: Note
}

interface ActionItem {
  type: 'action'
  action: Action
}

type Item = NoteItem | ActionItem

interface CommandPaletteProps {
  onClose: () => void
  onOpenSettings: () => void
  onOpenAudit: () => void
}

// Sequential subsequence match. Returns score (lower = better) or -1 for no match.
function fuzzyScore(query: string, text: string): number {
  if (!query) return 0
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  if (t === q) return 0
  let qi = 0
  let lastMatch = -1
  let totalGap = 0
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      if (lastMatch >= 0) totalGap += ti - lastMatch - 1
      lastMatch = ti
      qi++
    }
  }
  if (qi !== q.length) return -1
  // Earlier first match + smaller gaps = better
  return lastMatch + totalGap * 2
}

export function CommandPalette({ onClose, onOpenSettings, onOpenAudit }: CommandPaletteProps) {
  const {
    notes, setActiveNote, addNote, toggleDarkMode, darkMode, setSidebarOpen,
    activeNoteId, pinNote, archiveNote, deleteNote,
  } = useNoteStore()

  // Combined state so changing the query naturally resets the selection to 0
  // without an extra effect (which would lint as setState-in-effect).
  const [{ query, selectedIdx }, setState] = useState({ query: '', selectedIdx: 0 })
  const setQuery = (q: string) => setState({ query: q, selectedIdx: 0 })
  const setSelectedIdx = (updater: number | ((i: number) => number)) =>
    setState((s) => ({
      ...s,
      selectedIdx: typeof updater === 'function' ? updater(s.selectedIdx) : updater,
    }))
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  // Lock scroll + autofocus + Esc to close
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    inputRef.current?.focus()
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  const actions: Action[] = useMemo(() => [
    {
      id: 'new-note',
      label: 'New note',
      hint: 'Cmd+N',
      icon: <Plus className="w-4 h-4" />,
      run: () => {
        addNote({ title: 'New Note', content: '# New Note\n\nStart writing...' })
      },
    },
    {
      id: 'toggle-dark',
      label: darkMode ? 'Switch to light theme' : 'Switch to dark theme',
      icon: darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />,
      run: () => toggleDarkMode(),
    },
    {
      id: 'open-settings',
      label: 'Open settings',
      icon: <SettingsIcon className="w-4 h-4" />,
      run: () => onOpenSettings(),
    },
    {
      id: 'open-audit',
      label: 'Run markdown audit',
      icon: <FlaskConical className="w-4 h-4" />,
      run: () => onOpenAudit(),
    },
    {
      id: 'focus-search',
      label: 'Focus sidebar search',
      hint: 'Cmd+K',
      icon: <Search className="w-4 h-4" />,
      run: () => {
        setSidebarOpen(true)
        window.dispatchEvent(new Event('clawy:focus-search'))
      },
    },
    ...(activeNoteId
      ? [
          {
            id: 'pin-active',
            label: 'Pin / unpin current note',
            icon: <Pin className="w-4 h-4" />,
            run: () => pinNote(activeNoteId),
          } as Action,
          {
            id: 'archive-active',
            label: 'Archive / unarchive current note',
            icon: <Archive className="w-4 h-4" />,
            run: () => archiveNote(activeNoteId),
          } as Action,
          {
            id: 'delete-active',
            label: 'Delete current note',
            icon: <Trash2 className="w-4 h-4" />,
            run: () => {
              if (window.confirm('Delete the current note? This cannot be undone.')) {
                deleteNote(activeNoteId)
              }
            },
          } as Action,
        ]
      : []),
  ], [
    addNote, toggleDarkMode, darkMode, onOpenSettings, onOpenAudit,
    setSidebarOpen, activeNoteId, pinNote, archiveNote, deleteNote,
  ])

  const items: Item[] = useMemo(() => {
    const q = query.trim()
    if (!q) {
      // Default view: actions + recent (non-archived) notes
      const recent: Item[] = notes
        .filter((n) => !n.isArchived)
        .slice(0, 12)
        .map((note) => ({ type: 'note', note }))
      const acts: Item[] = actions.map((action) => ({ type: 'action', action }))
      return [...acts, ...recent]
    }
    // Fuzzy search both
    const scoredNotes = notes
      .filter((n) => !n.isArchived)
      .map((note) => ({ note, score: fuzzyScore(q, note.title) }))
      .filter((x) => x.score !== -1)
      .sort((a, b) => a.score - b.score)
      .slice(0, 20)
      .map(({ note }): Item => ({ type: 'note', note }))
    const scoredActions = actions
      .map((action) => ({ action, score: fuzzyScore(q, action.label) }))
      .filter((x) => x.score !== -1)
      .sort((a, b) => a.score - b.score)
      .map(({ action }): Item => ({ type: 'action', action }))
    return [...scoredActions, ...scoredNotes]
  }, [query, notes, actions])

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-cp-idx="${selectedIdx}"]`,
    )
    el?.scrollIntoView({ block: 'nearest' })
  }, [selectedIdx])

  const runItem = (item: Item) => {
    if (item.type === 'note') {
      setActiveNote(item.note.id)
    } else {
      item.action.run()
    }
    onClose()
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIdx((i) => Math.min(items.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIdx((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[selectedIdx]
      if (item) runItem(item)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-[70] flex items-start justify-center pt-[10vh] px-4 bg-black/40 backdrop-blur-sm animate-fade-in-up"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        ref={dialogRef}
        className="w-full max-w-xl rounded-2xl bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] shadow-2xl overflow-hidden animate-scale-in"
      >
        <div className="px-4 pt-3 pb-2 border-b border-[var(--bg-tertiary)]">
          <input
            ref={inputRef}
            type="text"
            placeholder="Search notes or run a command…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKey}
            className="w-full bg-transparent border-0 outline-none text-base text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
            autoComplete="off"
            spellCheck={false}
          />
        </div>
        <ul
          ref={listRef}
          role="listbox"
          aria-activedescendant={items[selectedIdx] ? `cp-item-${selectedIdx}` : undefined}
          className="max-h-[60vh] overflow-y-auto py-1 scrollbar-thin"
        >
          {items.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-[var(--text-tertiary)]">
              No matches
            </li>
          )}
          {items.map((item, idx) => {
            const id = `cp-item-${idx}`
            const isActive = idx === selectedIdx
            const baseCls = `flex items-center gap-3 px-4 py-2 cursor-pointer ${
              isActive ? 'bg-[var(--accent)]/10 text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'
            }`
            if (item.type === 'note') {
              return (
                <li
                  key={`note-${item.note.id}`}
                  id={id}
                  data-cp-idx={idx}
                  role="option"
                  aria-selected={isActive}
                  className={baseCls}
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={() => runItem(item)}
                >
                  <FileText className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`} />
                  <span className="flex-1 truncate">{item.note.title}</span>
                  {item.note.isPinned && <Pin className="w-3 h-3 text-[var(--accent)] flex-shrink-0" />}
                  {item.note.tags.length > 0 && (
                    <span className="flex items-center gap-1 text-[var(--text-tertiary)] text-xs flex-shrink-0">
                      <TagIcon className="w-3 h-3" />
                      {item.note.tags.length}
                    </span>
                  )}
                </li>
              )
            }
            return (
              <li
                key={`act-${item.action.id}`}
                id={id}
                data-cp-idx={idx}
                role="option"
                aria-selected={isActive}
                className={baseCls}
                onMouseEnter={() => setSelectedIdx(idx)}
                onClick={() => runItem(item)}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`}>
                  {item.action.icon}
                </span>
                <span className="flex-1 truncate">{item.action.label}</span>
                {item.action.hint && (
                  <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded border border-[var(--bg-tertiary)] text-[var(--text-tertiary)] flex-shrink-0">
                    {item.action.hint}
                  </kbd>
                )}
              </li>
            )
          })}
        </ul>
        <div className="px-3 py-1.5 border-t border-[var(--bg-tertiary)] flex items-center gap-3 text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-primary)]">
          <span><kbd className="font-mono">↑↓</kbd> navigate</span>
          <span><kbd className="font-mono">Enter</kbd> open</span>
          <span><kbd className="font-mono">Esc</kbd> close</span>
        </div>
      </div>
    </div>
  )
}
