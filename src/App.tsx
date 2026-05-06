import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import {
  Plus, Search, Menu, Moon, Sun, Eye, Edit3, Columns2,
  Folder, Tag, Pin, Archive, Trash2, ChevronLeft, FileText,
  Bold, Italic, Heading, List, CheckSquare,
  Strikethrough, Code, Link as LinkIcon, Quote, ListOrdered
} from 'lucide-react'
import { useNoteStore } from './store'
import { renderMarkdown, extractTitle, formatDate } from './lib'
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

function Toolbar({ onWrap, onPrefix, onLink }: ToolbarProps) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 sm:gap-1 sm:px-3 sm:py-2 border-b border-[var(--bg-tertiary)] bg-[var(--bg-secondary)]">
      <ToolbarButton onClick={() => onWrap('**', '**', 'bold')} title="Bold" shortcut="Ctrl+B">
        <Bold className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onWrap('*', '*', 'italic')} title="Italic" shortcut="Ctrl+I">
        <Italic className="w-4 h-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => onWrap('~~', '~~', 'strike')} title="Strikethrough">
        <Strikethrough className="w-4 h-4" />
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
    </div>
  )
}

// Sidebar component
function Sidebar() {
  const {
    notes, folders, tags, activeNoteId, sidebarOpen, searchQuery,
    setActiveNote, setSidebarOpen, setSearchQuery, addNote, addFolder,
    getNotesByFolder, getPinnedNotes, searchNotes
  } = useNoteStore()

  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [activeFolder, setActiveFolder] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const focus = () => {
      requestAnimationFrame(() => {
        searchRef.current?.focus()
        searchRef.current?.select()
      })
    }
    window.addEventListener('clawy:focus-search', focus)
    return () => window.removeEventListener('clawy:focus-search', focus)
  }, [])

  const displayedNotes = searchQuery
    ? searchNotes(searchQuery)
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
              <span className="font-bold text-[var(--text-primary)]">Clawy</span>
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
        </div>
      </div>

      {/* Tags */}
      <div className="px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">Tags</h3>
        <div className="flex flex-wrap gap-1">
          {tags.map(tag => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium"
              style={{ backgroundColor: tag.color + '20', color: tag.color }}
            >
              <Tag className="w-3 h-3" />
              {tag.name}
            </span>
          ))}
        </div>
      </div>

      {/* Note List */}
      <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-thin">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
          {searchQuery ? 'Search Results' : activeFolder ? 'Notes' : 'Recent'}
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
      </aside>
    </>
  )
}

// Main Editor Component
function Editor() {
  const { getActiveNote, updateNote, viewMode, setViewMode, deleteNote, pinNote, archiveNote, darkMode, sidebarOpen } = useNoteStore()
  const note = getActiveNote()
  const editorRef = useRef<MarkdownEditorHandle>(null)
  const content = note?.content ?? ''

  const [confirmDeleteFor, setConfirmDeleteFor] = useState<string | null>(null)
  const confirmingDelete = note != null && confirmDeleteFor === note.id

  useEffect(() => {
    if (!confirmingDelete) return
    const timer = window.setTimeout(() => setConfirmDeleteFor(null), 3000)
    return () => window.clearTimeout(timer)
  }, [confirmingDelete])

  const handleContentChange = useCallback((newContent: string) => {
    if (!note) return
    const title = extractTitle(newContent)
    updateNote(note.id, { content: newContent, title })
  }, [note, updateNote])

  const handleWrap = (prefix: string, suffix?: string, placeholder?: string) => {
    editorRef.current?.wrapSelection(prefix, suffix, placeholder)
  }

  const handlePrefix = (prefix: string) => {
    editorRef.current?.prefixLine(prefix)
  }

  const handleLink = () => {
    // [text](url) — wrap selection as the link text, leave cursor on url placeholder.
    editorRef.current?.wrapSelection('[', '](url)', 'link')
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
    <div className="flex-1 flex flex-col bg-[var(--bg-primary)]">
      {/* Note Header */}
      <div className={`flex items-center justify-between py-3 pr-4 border-b border-[var(--bg-tertiary)] ${sidebarOpen ? 'pl-4' : 'pl-16'}`}>
        <div className="flex items-center gap-2 min-w-0">
          <h2 className="text-lg font-semibold font-display text-[var(--text-primary)] truncate">{note.title}</h2>
          {note.isPinned && <Pin className="w-4 h-4 text-[var(--accent)] flex-shrink-0" />}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => pinNote(note.id)} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors" title="Pin">
            <Pin className={`w-4 h-4 ${note.isPinned ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`} />
          </button>
          <button onClick={() => archiveNote(note.id)} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors" title="Archive">
            <Archive className="w-4 h-4 text-[var(--text-tertiary)]" />
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
          <div className="w-px h-6 bg-[var(--bg-tertiary)] mx-1" />
          <button
            onClick={() => setViewMode('editor')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'editor' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'}`}
            title="Editor Only"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'split' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'}`}
            title="Split View"
          >
            <Columns2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('preview')}
            className={`p-2 rounded-lg transition-colors ${viewMode === 'preview' ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]'}`}
            title="Preview Only"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      {viewMode !== 'preview' && (
        <Toolbar onWrap={handleWrap} onPrefix={handlePrefix} onLink={handleLink} />
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
            <div
              className="prose prose-sm max-w-none p-4 dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(content) }}
            />
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

// Main App
function App() {
  const { darkMode, toggleDarkMode, addNote, sidebarOpen, setSidebarOpen } = useNoteStore()

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

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

  return (
    <div className="h-screen flex bg-[var(--bg-primary)]">
      <Sidebar />
      <Editor />
      <button
        onClick={toggleDarkMode}
        className="fixed bottom-4 right-4 p-3 rounded-full bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] shadow-lg hover-lift z-50"
      >
        {darkMode ? <Sun className="w-5 h-5 text-[var(--text-secondary)]" /> : <Moon className="w-5 h-5 text-[var(--text-secondary)]" />}
      </button>
    </div>
  )
}

export default App
