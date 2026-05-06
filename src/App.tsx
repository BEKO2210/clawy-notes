import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import type { Note } from './types'
import {
  Plus, Search, Menu, Moon, Sun, Eye, Edit3, Columns2,
  Folder, Tag, Pin, Archive, Trash2, ChevronLeft, FileText,
  Bold, Italic, Heading, List, CheckSquare,
  Strikethrough, Code, Link as LinkIcon, Quote, ListOrdered,
  Table as TableIcon, Image as ImageIcon, Minus, Code2, X, Check,
  Settings as SettingsIcon, Highlighter, ChevronUp, ChevronDown,
  PanelRight
} from 'lucide-react'
import { SettingsModal } from './SettingsModal'
import { AuditPage } from './AuditPage'
import { CommandPalette } from './CommandPalette'
import { RightSidebar } from './RightSidebar'

const TAG_PALETTE = [
  '#0ea5e9', '#22c55e', '#f59e0b', '#ef4444',
  '#8b5cf6', '#ec4899', '#14b8a6', '#a3a3a3',
] as const
import { useNoteStore } from './store'
import { renderMarkdown, extractTitle, formatDate, toggleTaskInContent } from './lib'
import type { MarkdownEditorHandle } from './MarkdownEditor'
import './App.css'

const MarkdownEditor = lazy(async () => ({
  default: (await import('./MarkdownEditor')).MarkdownEditor,
}))

function EditorSkeleton() {
  return (
    <div className="h-full w-full p-5 space-y-3" aria-hidden>
      <div className="h-5 w-2/5 rounded bg-[var(--bg-tertiary)] animate-pulse-soft" />
      <div className="h-3 w-11/12 rounded bg-[var(--bg-tertiary)] animate-pulse-soft" />
      <div className="h-3 w-10/12 rounded bg-[var(--bg-tertiary)] animate-pulse-soft" />
      <div className="h-3 w-9/12 rounded bg-[var(--bg-tertiary)] animate-pulse-soft" />
      <div className="h-3 w-7/12 rounded bg-[var(--bg-tertiary)] animate-pulse-soft" />
    </div>
  )
}

// Editor toolbar — wraps selection or prepends to current line, Obsidian-style.
interface ToolbarProps {
  onWrap: (prefix: string, suffix?: string, placeholder?: string) => void
  onPrefix: (prefix: string) => void
  onLink: () => void
  onImage: () => void
  onCodeBlock: () => void
  onTable: () => void
  onHr: () => void
}

function ToolbarButton({
  onClick,
  title,
  shortcut,
  children,
}: {
  onClick: () => void
  title: string
  shortcut?: string
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={shortcut ? `${title} (${shortcut})` : title}
      aria-label={title}
      className="p-2 rounded-md hover:bg-[var(--bg-tertiary)] active:scale-95 transition-all duration-150 text-[var(--text-secondary)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <span className="mx-0.5 h-5 w-px bg-[var(--bg-tertiary)] shrink-0" aria-hidden />
}

function Toolbar({ onWrap, onPrefix, onLink, onImage, onCodeBlock, onTable, onHr }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 sm:gap-1 sm:px-3 sm:py-2 border-b border-[var(--bg-tertiary)] bg-[var(--bg-secondary)]">
      <ToolbarButton onClick={() => onWrap('**', '**', 'bold')} title="Bold" shortcut="Ctrl+B">
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onWrap('*', '*', 'italic')} title="Italic" shortcut="Ctrl+I">
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onWrap('~~', '~~', 'strike')} title="Strikethrough" shortcut="Ctrl+Shift+X">
        <Strikethrough className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onWrap('==', '==', 'highlight')} title="Highlight" shortcut="Ctrl+Shift+H">
        <Highlighter className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onWrap('^', '^', 'sup')} title="Superscript">
        <ChevronUp className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onWrap('~', '~', 'sub')} title="Subscript">
        <ChevronDown className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onWrap('`', '`', 'code')} title="Inline code" shortcut="Ctrl+`">
        <Code className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton onClick={() => onPrefix('# ')} title="Heading">
        <Heading className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onPrefix('> ')} title="Quote">
        <Quote className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onPrefix('- ')} title="Bulleted list">
        <List className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onPrefix('1. ')} title="Numbered list">
        <ListOrdered className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onPrefix('- [ ] ')} title="Checkbox">
        <CheckSquare className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarDivider />
      <ToolbarButton onClick={onLink} title="Link">
        <LinkIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onImage} title="Image">
        <ImageIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onCodeBlock} title="Code block">
        <Code2 className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onTable} title="Table">
        <TableIcon className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onHr} title="Horizontal rule">
        <Minus className="w-4 h-4" />
      </ToolbarButton>
    </div>
  )
}

// Sidebar component
function Sidebar() {
  const {
    notes, folders, tags, activeNoteId, sidebarOpen, searchQuery,
    activeFolderId, setActiveFolder,
    setActiveNote, setSidebarOpen, setSearchQuery, addNote, addFolder,
    addTag, deleteTag,
    getNotesByFolder, getPinnedNotes, searchNotes
  } = useNoteStore()
  const activeFolder = activeFolderId

  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewTag, setShowNewTag] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState<string>(TAG_PALETTE[0])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focus = () => {
      requestAnimationFrame(() => {
        searchRef.current?.focus()
        searchRef.current?.select()
      })
    }
    const openSettings = () => setSettingsOpen(true)
    window.addEventListener('clawy:focus-search', focus)
    window.addEventListener('clawy:open-settings', openSettings)
    return () => {
      window.removeEventListener('clawy:focus-search', focus)
      window.removeEventListener('clawy:open-settings', openSettings)
    }
  }, [])

  const archivedCount = notes.filter(n => n.isArchived).length

  const displayedNotes = searchQuery
    ? searchNotes(searchQuery)
    : activeFolder === '__archive__'
    ? notes.filter(n => n.isArchived)
    : activeFolder
    ? getNotesByFolder(activeFolder)
    : getPinnedNotes().length > 0
    ? [...getPinnedNotes(), ...notes.filter(n => !n.isPinned && !n.isArchived)]
    : notes.filter(n => !n.isArchived)

  const closeOnMobile = () => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches) {
      setSidebarOpen(false)
    }
  }

  const handleNewFolder = (e: React.FormEvent) => {
    e.preventDefault()
    if (newFolderName.trim()) {
      addFolder(newFolderName)
      setNewFolderName('')
      setShowNewFolder(false)
    }
  }

  const handleNewTag = (e: React.FormEvent) => {
    e.preventDefault()
    if (newTagName.trim()) {
      addTag(newTagName.trim(), newTagColor)
      setNewTagName('')
      setShowNewTag(false)
    }
  }

  const handlePickNote = (id: string) => {
    setActiveNote(id)
    closeOnMobile()
  }

  const handleNewNote = () => {
    addNote({ title: 'New Note', content: '# New Note\n\nStart writing...' })
    closeOnMobile()
  }

  return (
    <>
      {/* Floating menu button — visible whenever the drawer/sidebar is closed */}
      {!sidebarOpen && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed left-4 top-4 z-30 p-2.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] hover-lift"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5 text-[var(--text-secondary)]" />
        </button>
      )}

      {/* Mobile-only backdrop */}
      {sidebarOpen && (
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
        />
      )}

      {/* Sidebar — mobile drawer, desktop static column */}
      <aside
        className={[
          'flex flex-col h-screen w-72',
          'bg-[var(--bg-secondary)] border-r border-[var(--bg-tertiary)]',
          'fixed inset-y-0 left-0 z-50',
          'transition-transform duration-300 ease-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
          'md:static md:translate-x-0 md:w-64 md:transition-none',
          sidebarOpen ? 'md:flex' : 'md:hidden',
        ].join(' ')}
        aria-hidden={!sidebarOpen}
      >
      {/* Header */}
      <div className="p-4 border-b border-[var(--bg-tertiary)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="w-7 h-7 rounded-lg shadow-sm" />
            <h1 className="text-lg font-display tracking-tight leading-none">
              <span className="font-bold text-[var(--text-primary)]">Plume</span>
              <span className="font-medium text-[var(--text-secondary)] ml-1">Notes</span>
            </h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-2 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
            aria-label="Close menu"
          >
            <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>
        <button
          onClick={handleNewNote}
          className="w-full flex items-center gap-2 px-3 py-2.5 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors active-press"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">New Note</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)] pointer-events-none" />
          <input
            ref={searchRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-9 pr-12 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <kbd className="absolute right-2 top-1/2 -translate-y-1/2 hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-[var(--bg-tertiary)] bg-[var(--bg-secondary)] text-[10px] font-mono text-[var(--text-tertiary)]">
            ⌘K
          </kbd>
        </div>
      </div>

      {/* Folders */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Folders</h3>
          <button onClick={() => setShowNewFolder(!showNewFolder)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
            <Plus className="w-3 h-3 text-[var(--text-tertiary)]" />
          </button>
        </div>
        {showNewFolder && (
          <form onSubmit={handleNewFolder} className="mb-2">
            <input
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Folder name"
              className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              autoFocus
            />
          </form>
        )}
        <div className="space-y-1">
          <button
            onClick={() => setActiveFolder(null)}
            className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
              activeFolder === null ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            <Folder className="w-4 h-4" />
            <span>All Notes</span>
            <span className="ml-auto text-xs text-[var(--text-tertiary)]">{notes.filter(n => !n.isArchived).length}</span>
          </button>
          {folders.map(folder => (
            <button
              key={folder.id}
              onClick={() => setActiveFolder(folder.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                activeFolder === folder.id ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: folder.color }} />
              <span>{folder.name}</span>
              <span className="ml-auto text-xs text-[var(--text-tertiary)]">
                {notes.filter(n => n.folderId === folder.id && !n.isArchived).length}
              </span>
            </button>
          ))}
          {archivedCount > 0 && (
            <button
              onClick={() => setActiveFolder('__archive__')}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
                activeFolder === '__archive__'
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <Archive className="w-4 h-4" />
              <span>Archive</span>
              <span className="ml-auto text-xs text-[var(--text-tertiary)]">{archivedCount}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="px-3 py-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">Tags</h3>
          <button
            onClick={() => setShowNewTag(v => !v)}
            className="p-1 rounded hover:bg-[var(--bg-tertiary)] transition-colors"
            aria-label="Add tag"
          >
            <Plus className="w-3 h-3 text-[var(--text-tertiary)]" />
          </button>
        </div>
        {showNewTag && (
          <form onSubmit={handleNewTag} className="mb-2 space-y-1.5">
            <input
              type="text"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Tag name"
              className="w-full px-2 py-1.5 rounded bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--accent)]"
              autoFocus
            />
            <div className="flex flex-wrap gap-1">
              {TAG_PALETTE.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setNewTagColor(c)}
                  aria-label={`Pick color ${c}`}
                  className={`w-5 h-5 rounded-full transition-transform ${newTagColor === c ? 'scale-110 ring-2 ring-offset-1 ring-offset-[var(--bg-secondary)]' : ''}`}
                  style={{ backgroundColor: c, ...(newTagColor === c ? { boxShadow: `0 0 0 2px ${c}` } : {}) }}
                />
              ))}
            </div>
          </form>
        )}
        {tags.length === 0 ? (
          <p className="text-xs text-[var(--text-tertiary)]">No tags yet.</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {tags.map(tag => (
              <span
                key={tag.id}
                className="group inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
                style={{ backgroundColor: tag.color + '22', color: tag.color }}
              >
                <Tag className="w-3 h-3" />
                {tag.name}
                <button
                  onClick={() => deleteTag(tag.id)}
                  aria-label={`Delete tag ${tag.name}`}
                  className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full hover:bg-black/10 p-0.5 leading-none"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
          {searchQuery
            ? 'Search Results'
            : activeFolder === '__archive__'
            ? 'Archive'
            : activeFolder
            ? 'Notes'
            : 'Recent'}
        </h3>
        <div className="space-y-1">
          {displayedNotes.map(note => (
            <button
              key={note.id}
              onClick={() => handlePickNote(note.id)}
              className={`w-full text-left p-2 rounded-lg transition-colors ${
                activeNoteId === note.id
                  ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20'
                  : 'hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <div className="flex items-start gap-2">
                {note.isPinned && <Pin className="w-3 h-3 text-[var(--accent)] mt-0.5 flex-shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {note.title}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    {formatDate(note.updatedAt)}
                  </p>
                  {note.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {note.tags.slice(0, 3).map(tagId => {
                        const tag = tags.find(t => t.id === tagId)
                        if (!tag) return null
                        return (
                          <span
                            key={tag.id}
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium leading-none"
                            style={{ backgroundColor: tag.color + '22', color: tag.color }}
                          >
                            {tag.name}
                          </span>
                        )
                      })}
                      {note.tags.length > 3 && (
                        <span className="text-[10px] leading-none text-[var(--text-tertiary)] self-center">
                          +{note.tags.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </button>
          ))}
          {displayedNotes.length === 0 && (
            <p className="text-sm text-[var(--text-tertiary)] text-center py-4">No notes found</p>
          )}
        </div>
      </div>

      {/* Footer: settings */}
      <div className="border-t border-[var(--bg-tertiary)] px-3 py-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary)]">
          {notes.filter(n => !n.isArchived).length} active · {notes.filter(n => n.isArchived).length} archived
        </span>
        <button
          onClick={() => setSettingsOpen(true)}
          className="p-1.5 rounded-md text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          aria-label="Open settings"
          title="Settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
      </aside>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </>
  )
}

// Preview pane — renders markdown HTML with interactive task checkboxes,
// wikilink navigation, and copy-buttons inside fenced code blocks.
function PreviewPane({ note }: { note: Note }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const { notes, updateNote, addNote, setActiveNote, darkMode } = useNoteStore()
  const existingTitles = useMemo(
    () => new Set(notes.filter((n) => !n.isArchived).map((n) => n.title)),
    [notes],
  )
  const html = useMemo(
    () => renderMarkdown(note.content, { existingTitles }),
    [note.content, existingTitles],
  )

  // Lazy-render KaTeX + Mermaid in any [data-katex] / [data-mermaid] elements.
  // The chunks (katex + mermaid) only download when the active note actually
  // needs them — keeps the initial bundle small.
  useEffect(() => {
    const root = containerRef.current
    if (!root) return
    let cancelled = false

    const katexEls = Array.from(
      root.querySelectorAll<HTMLElement>('[data-katex]'),
    )
    if (katexEls.length > 0) {
      Promise.all([
        import('katex'),
        import('katex/dist/katex.min.css'),
      ]).then(([{ default: katex }]) => {
        if (cancelled) return
        for (const el of katexEls) {
          const tex = el.textContent ?? ''
          const block = el.getAttribute('data-katex') === 'block'
          try {
            el.innerHTML = katex.renderToString(tex, {
              displayMode: block,
              throwOnError: false,
              output: 'html',
            })
          } catch {
            // katex.renderToString already swallows on throwOnError:false
          }
          el.removeAttribute('data-katex')
        }
      })
    }

    const mermaidEls = Array.from(
      root.querySelectorAll<HTMLElement>('[data-mermaid]'),
    )
    if (mermaidEls.length > 0) {
      import('mermaid').then(async ({ default: mermaid }) => {
        if (cancelled) return
        mermaid.initialize({
          startOnLoad: false,
          theme: darkMode ? 'dark' : 'default',
          securityLevel: 'strict',
        })
        for (const el of mermaidEls) {
          const src = el.textContent ?? ''
          const id = `m${Math.random().toString(36).slice(2, 10)}`
          try {
            const { svg } = await mermaid.render(id, src)
            if (cancelled) return
            el.innerHTML = svg
          } catch (err) {
            if (cancelled) return
            el.innerHTML = ''
            el.textContent = `Mermaid error: ${(err as Error).message}`
            el.classList.add('plume-mermaid-error')
          }
          el.removeAttribute('data-mermaid')
        }
      })
    }

    return () => {
      cancelled = true
    }
  }, [html, darkMode])

  useEffect(() => {
    const root = containerRef.current
    if (!root) return

    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null
      if (!target) return

      // Task list checkbox
      const checkbox = target.closest<HTMLInputElement>('input[data-task-idx]')
      if (checkbox) {
        e.preventDefault()
        const idx = Number(checkbox.dataset.taskIdx)
        if (Number.isFinite(idx)) {
          updateNote(note.id, { content: toggleTaskInContent(note.content, idx) })
        }
        return
      }

      // Wikilink
      const wiki = target.closest<HTMLAnchorElement>('a[data-wikilink]')
      if (wiki) {
        e.preventDefault()
        const title = wiki.dataset.wikilink ?? ''
        const match = notes.find(
          (n) => n.title.toLowerCase() === title.toLowerCase() && !n.isArchived,
        )
        if (match) {
          setActiveNote(match.id)
        } else if (title) {
          addNote({ title, content: `# ${title}\n\n` })
        }
        return
      }

      // External link → open in new tab
      const ext = target.closest<HTMLAnchorElement>('a[href]:not([data-wikilink])')
      if (ext) {
        const href = ext.getAttribute('href') ?? ''
        if (/^https?:\/\//i.test(href)) {
          e.preventDefault()
          window.open(href, '_blank', 'noopener,noreferrer')
        }
        return
      }

      // Code block copy
      const copy = target.closest<HTMLButtonElement>('button[data-copy]')
      if (copy) {
        e.preventDefault()
        const text = decodeURIComponent(copy.dataset.copy ?? '')
        navigator.clipboard.writeText(text).then(() => {
          copy.dataset.copied = 'true'
          copy.textContent = 'Copied'
          window.setTimeout(() => {
            delete copy.dataset.copied
            copy.textContent = 'Copy'
          }, 1200)
        })
      }
    }

    const onScrollToHeading = (e: Event) => {
      const ce = e as CustomEvent<{ text: string }>
      const text = ce.detail?.text
      if (!text || !root) return
      const headings = root.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')
      for (const h of headings) {
        if (h.textContent?.trim() === text) {
          h.scrollIntoView({ behavior: 'smooth', block: 'start' })
          h.classList.add('plume-heading-flash')
          window.setTimeout(() => h.classList.remove('plume-heading-flash'), 800)
          return
        }
      }
    }

    root.addEventListener('click', onClick)
    window.addEventListener('clawy:scroll-to-heading', onScrollToHeading)
    return () => {
      root.removeEventListener('click', onClick)
      window.removeEventListener('clawy:scroll-to-heading', onScrollToHeading)
    }
  }, [note.id, note.content, notes, updateNote, addNote, setActiveNote])

  return (
    <div
      ref={containerRef}
      className="prose prose-sm max-w-none p-4 dark:prose-invert"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}

// Main Editor Component
function Editor() {
  const { getActiveNote, updateNote, viewMode, setViewMode, deleteNote, pinNote, archiveNote, darkMode, sidebarOpen, tags, folders, rightSidebarOpen, setRightSidebarOpen } = useNoteStore()
  const note = getActiveNote()
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const content = note?.content ?? ''

  const [confirmDeleteFor, setConfirmDeleteFor] = useState<string | null>(null)
  const confirmingDelete = note != null && confirmDeleteFor === note.id
  const [showTagPicker, setShowTagPicker] = useState(false)
  const [showFolderPicker, setShowFolderPicker] = useState(false)
  const tagPickerRef = useRef<HTMLDivElement>(null)
  const folderPickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!confirmingDelete) return
    const timer = window.setTimeout(() => setConfirmDeleteFor(null), 3000)
    return () => window.clearTimeout(timer)
  }, [confirmingDelete])

  useEffect(() => {
    if (!showTagPicker) return
    const onClick = (e: MouseEvent) => {
      if (!tagPickerRef.current?.contains(e.target as Node)) {
        setShowTagPicker(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowTagPicker(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [showTagPicker])

  useEffect(() => {
    if (!showFolderPicker) return
    const onClick = (e: MouseEvent) => {
      if (!folderPickerRef.current?.contains(e.target as Node)) {
        setShowFolderPicker(false)
      }
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowFolderPicker(false)
    }
    document.addEventListener('mousedown', onClick)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClick)
      document.removeEventListener('keydown', onKey)
    }
  }, [showFolderPicker])

  const moveToFolder = (folderId: string) => {
    if (!note) return
    updateNote(note.id, { folderId })
    setShowFolderPicker(false)
  }

  const toggleNoteTag = (tagId: string) => {
    if (!note) return
    const has = note.tags.includes(tagId)
    const next = has ? note.tags.filter(id => id !== tagId) : [...note.tags, tagId]
    updateNote(note.id, { tags: next })
  }

  const handleContentChange = (newContent: string) => {
    if (!note) return
    const title = extractTitle(newContent)
    updateNote(note.id, { content: newContent, title })
  }

  const handleWrap = (prefix: string, suffix?: string, placeholder?: string) => {
    editorRef.current?.wrapSelection(prefix, suffix, placeholder)
  }

  const handlePrefix = (prefix: string) => {
    editorRef.current?.prefixLine(prefix)
  }

  const handleLink = () => {
    editorRef.current?.wrapSelection('[', '](url)', 'link')
  }

  const handleImage = () => {
    editorRef.current?.wrapSelection('![', '](url)', 'alt text')
  }

  const handleCodeBlock = () => {
    editorRef.current?.wrapSelection('```\n', '\n```', 'code')
  }

  const handleTable = () => {
    editorRef.current?.insertAtCursor(
      '\n| Column 1 | Column 2 | Column 3 |\n| --- | --- | --- |\n| Row 1 | Row 1 | Row 1 |\n| Row 2 | Row 2 | Row 2 |\n',
    )
  }

  const handleHr = () => {
    editorRef.current?.insertAtCursor('\n\n---\n\n')
  }

  const handleDelete = () => {
    if (!note) return
    if (confirmingDelete) {
      deleteNote(note.id)
      setConfirmDeleteFor(null)
    } else {
      setConfirmDeleteFor(note.id)
    }
  }

  if (!note) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[var(--bg-primary)]">
        <div className="text-center">
          <FileText className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-lg font-medium text-[var(--text-secondary)]">Select a note or create one</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1">Your markdown notes will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)] min-w-0 overflow-hidden">
      {/* Note Header */}
      <div className={`flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5 py-3 pr-3 border-b border-[var(--bg-tertiary)] ${sidebarOpen ? 'pl-4' : 'pl-16'}`}>
        <div className="flex items-center gap-2 min-w-0 basis-full sm:basis-auto sm:flex-1">
          <h2 className="text-base sm:text-lg font-semibold font-display text-[var(--text-primary)] truncate">{note.title}</h2>
          {note.isPinned && <Pin className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0 flex-wrap">
          <div className="relative" ref={folderPickerRef}>
            <button
              onClick={() => setShowFolderPicker(v => !v)}
              className="p-2 rounded-lg transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]"
              title="Move to folder"
              aria-expanded={showFolderPicker}
            >
              <Folder className="w-4 h-4" />
            </button>
            {showFolderPicker && (
              <div className="absolute right-0 top-full mt-1 z-30 w-56 max-h-64 overflow-y-auto rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-secondary)] shadow-xl p-1.5 animate-scale-in">
                <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
                  Move to
                </p>
                {folders.map((f) => {
                  const active = note.folderId === f.id
                  return (
                    <button
                      key={f.id}
                      onClick={() => moveToFolder(f.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                    >
                      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: f.color }} />
                      <span className="text-sm text-[var(--text-primary)] truncate flex-1">{f.name}</span>
                      {active && <Check className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          <div className="relative" ref={tagPickerRef}>
            <button
              onClick={() => setShowTagPicker(v => !v)}
              className={`relative p-2 rounded-lg transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                note.tags.length > 0
                  ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-inset ring-[var(--accent)]/20'
                  : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
              }`}
              title="Tags"
              aria-expanded={showTagPicker}
              aria-pressed={note.tags.length > 0}
            >
              <Tag className="w-4 h-4" />
              {note.tags.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-[14px] h-[14px] px-1 rounded-full bg-[var(--accent)] text-white text-[9px] font-semibold leading-none shadow-sm">
                  {note.tags.length}
                </span>
              )}
            </button>
            {showTagPicker && (
              <div className="absolute right-0 top-full mt-1 z-30 w-56 max-h-64 overflow-y-auto rounded-lg border border-[var(--bg-tertiary)] bg-[var(--bg-secondary)] shadow-xl p-1.5 animate-scale-in">
                {tags.length === 0 ? (
                  <p className="px-2 py-2 text-xs text-[var(--text-tertiary)]">
                    No tags yet. Create one in the sidebar.
                  </p>
                ) : (
                  tags.map(t => {
                    const has = note.tags.includes(t.id)
                    return (
                      <button
                        key={t.id}
                        onClick={() => toggleNoteTag(t.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors text-left"
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: t.color }} />
                        <span className="text-sm text-[var(--text-primary)] truncate flex-1">{t.name}</span>
                        {has && <Check className="w-3.5 h-3.5 text-[var(--accent)] flex-shrink-0" />}
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
          <button
            onClick={() => pinNote(note.id)}
            className={`p-2 rounded-lg transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              note.isPinned
                ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-inset ring-[var(--accent)]/20'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
            }`}
            title={note.isPinned ? 'Unpin' : 'Pin'}
            aria-pressed={note.isPinned}
          >
            <Pin className={`w-4 h-4 ${note.isPinned ? 'fill-current' : ''}`} />
          </button>
          <button
            onClick={() => archiveNote(note.id)}
            className={`p-2 rounded-lg transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              note.isArchived
                ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-inset ring-[var(--accent)]/20'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
            }`}
            title={note.isArchived ? 'Unarchive' : 'Archive'}
            aria-pressed={note.isArchived}
          >
            <Archive className="w-4 h-4" />
          </button>
          {confirmingDelete ? (
            <button
              onClick={handleDelete}
              onBlur={() => setConfirmDeleteFor(null)}
              autoFocus
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-red-500 text-white text-xs font-medium animate-scale-in shadow-sm hover:bg-red-600 active-press"
              title="Click again to confirm"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete?</span>
            </button>
          ) : (
            <button
              onClick={handleDelete}
              className="p-2 rounded-lg hover:bg-red-500/10 transition-colors group"
              title="Delete"
            >
              <Trash2 className="w-4 h-4 text-[var(--text-tertiary)] group-hover:text-red-500 transition-colors" />
            </button>
          )}
          <div className="ml-1 inline-flex items-center rounded-lg bg-[var(--bg-tertiary)]/60 p-0.5" role="group" aria-label="View mode">
            <button
              onClick={() => setViewMode('editor')}
              className={`p-1.5 rounded-md transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                viewMode === 'editor'
                  ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
              title="Editor only"
              aria-pressed={viewMode === 'editor'}
            >
              <Edit3 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('split')}
              className={`p-1.5 rounded-md transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                viewMode === 'split'
                  ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
              title="Split view"
              aria-pressed={viewMode === 'split'}
            >
              <Columns2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('preview')}
              className={`p-1.5 rounded-md transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                viewMode === 'preview'
                  ? 'bg-[var(--bg-primary)] text-[var(--accent)] shadow-sm'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-primary)]'
              }`}
              title="Preview only"
              aria-pressed={viewMode === 'preview'}
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
          <button
            onClick={() => setRightSidebarOpen(!rightSidebarOpen)}
            className={`hidden lg:inline-flex p-2 rounded-lg transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
              rightSidebarOpen
                ? 'bg-[var(--accent)]/15 text-[var(--accent)] ring-1 ring-inset ring-[var(--accent)]/20'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
            }`}
            title={rightSidebarOpen ? 'Hide inspector' : 'Show inspector'}
            aria-pressed={rightSidebarOpen}
          >
            <PanelRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      {viewMode !== 'preview' && (
        <Toolbar
          onWrap={handleWrap}
          onPrefix={handlePrefix}
          onLink={handleLink}
          onImage={handleImage}
          onCodeBlock={handleCodeBlock}
          onTable={handleTable}
          onHr={handleHr}
        />
      )}

      {/* Editor / Preview */}
      <div className="flex-1 flex overflow-hidden">
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} h-full`}>
            <Suspense fallback={<EditorSkeleton />}>
              <MarkdownEditor
                ref={editorRef}
                value={content}
                onChange={handleContentChange}
                darkMode={darkMode}
              />
            </Suspense>
          </div>
        )}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2 border-l border-[var(--bg-tertiary)]' : 'w-full'} h-full overflow-y-auto`}>
            <PreviewPane note={note} />
          </div>
        )}
      </div>

      {/* Status Bar */}
      <div className="px-4 py-2 border-t border-[var(--bg-tertiary)] bg-[var(--bg-secondary)] flex items-center justify-between text-xs text-[var(--text-tertiary)]">
        <span>{content.length} characters</span>
        <span>{content.split(/\s+/).filter(Boolean).length} words</span>
        <span>Last edited {formatDate(note.updatedAt)}</span>
      </div>
    </div>
  )
}

function RightSidebarContainer() {
  const { getActiveNote, rightSidebarOpen, setRightSidebarOpen } = useNoteStore()
  const note = getActiveNote()
  if (!note || !rightSidebarOpen) return null
  return <RightSidebar note={note} onClose={() => setRightSidebarOpen(false)} />
}

function HydrationSplash() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[var(--bg-primary)]">
      <div className="flex items-center gap-3 text-[var(--text-tertiary)]">
        <img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" className="w-8 h-8 animate-pulse-soft" />
        <span className="text-sm font-medium">Loading your notes…</span>
      </div>
    </div>
  )
}

// Main App
function App() {
  const { darkMode, toggleDarkMode, addNote, sidebarOpen, setSidebarOpen } = useNoteStore()
  const [hydrated, setHydrated] = useState(useNoteStore.persist.hasHydrated())
  const [auditOpen, setAuditOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    return new URLSearchParams(window.location.search).get('audit') === '1'
  })
  const [paletteOpen, setPaletteOpen] = useState(false)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  useEffect(() => {
    if (hydrated) return
    const unsub = useNoteStore.persist.onFinishHydration(() => setHydrated(true))
    return unsub
  }, [hydrated])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey
      const key = e.key.toLowerCase()

      if (meta && key === 'n') {
        e.preventDefault()
        addNote({ title: 'New Note', content: '# New Note\n\nStart writing...' })
        return
      }

      if (meta && key === 'k') {
        e.preventDefault()
        setSidebarOpen(true)
        window.dispatchEvent(new Event('clawy:focus-search'))
        return
      }

      if (meta && key === 'p') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }

      if (e.key === 'Escape' && sidebarOpen) {
        const isMobile = window.matchMedia('(max-width: 767px)').matches
        if (isMobile) {
          e.preventDefault()
          setSidebarOpen(false)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [addNote, sidebarOpen, setSidebarOpen])

  if (!hydrated) {
    return <HydrationSplash />
  }

  return (
    <div className="h-screen flex bg-[var(--bg-primary)]">
      <Sidebar />
      <Editor />
      <RightSidebarContainer />
      <button
        onClick={toggleDarkMode}
        className="fixed bottom-4 right-4 p-3 rounded-full bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] shadow-lg hover-lift z-50"
      >
        {darkMode ? <Sun className="w-5 h-5 text-[var(--text-secondary)]" /> : <Moon className="w-5 h-5 text-[var(--text-secondary)]" />}
      </button>
      {auditOpen && (
        <AuditPage
          onClose={() => {
            setAuditOpen(false)
            const url = new URL(window.location.href)
            url.searchParams.delete('audit')
            window.history.replaceState({}, '', url.toString())
          }}
        />
      )}
      {paletteOpen && (
        <CommandPalette
          onClose={() => setPaletteOpen(false)}
          onOpenSettings={() => {
            setPaletteOpen(false)
            window.dispatchEvent(new Event('clawy:open-settings'))
          }}
          onOpenAudit={() => {
            setPaletteOpen(false)
            setAuditOpen(true)
          }}
        />
      )}
    </div>
  )
}

export default App
