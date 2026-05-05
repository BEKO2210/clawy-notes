import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Plus, Search, Menu, Moon, Sun, Eye, Edit3, Columns2,
  Folder, Tag, Pin, Archive, Trash2, ChevronLeft, FileText,
  Bold, Italic, Heading, List, CheckSquare
} from 'lucide-react'
import { useNoteStore } from './store'
import { renderMarkdown, extractTitle, formatDate } from './lib'
import './App.css'

// Simple toolbar component
function Toolbar({ onInsert }: { onInsert: (text: string) => void }) {
  return (
    <div className="flex items-center gap-1 px-3 py-2 border-b border-[var(--bg-tertiary)] bg-[var(--bg-secondary)]">
      <button onClick={() => onInsert('**bold**')} className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors" title="Bold">
        <Bold className="w-4 h-4 text-[var(--text-secondary)]" />
      </button>
      <button onClick={() => onInsert('*italic*')} className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors" title="Italic">
        <Italic className="w-4 h-4 text-[var(--text-secondary)]" />
      </button>
      <button onClick={() => onInsert('\n# ')} className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors" title="Heading">
        <Heading className="w-4 h-4 text-[var(--text-secondary)]" />
      </button>
      <button onClick={() => onInsert('\n- ')} className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors" title="List">
        <List className="w-4 h-4 text-[var(--text-secondary)]" />
      </button>
      <button onClick={() => onInsert('\n- [ ] ')} className="p-1.5 rounded hover:bg-[var(--bg-tertiary)] transition-colors" title="Checkbox">
        <CheckSquare className="w-4 h-4 text-[var(--text-secondary)]" />
      </button>
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

  const displayedNotes = searchQuery
    ? searchNotes(searchQuery)
    : activeFolder
    ? getNotesByFolder(activeFolder)
    : getPinnedNotes().length > 0
    ? [...getPinnedNotes(), ...notes.filter(n => !n.isPinned && !n.isArchived)]
    : notes.filter(n => !n.isArchived)

  const handleNewFolder = (e: React.FormEvent) => {
    e.preventDefault()
    if (newFolderName.trim()) {
      addFolder(newFolderName)
      setNewFolderName('')
      setShowNewFolder(false)
    }
  }

  if (!sidebarOpen) {
    return (
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed left-4 top-4 z-20 p-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--bg-tertiary)] hover-lift"
      >
        <Menu className="w-5 h-5 text-[var(--text-secondary)]" />
      </button>
    )
  }

  return (
    <aside className="w-64 h-screen flex flex-col bg-[var(--bg-secondary)] border-r border-[var(--bg-tertiary)] animate-slide-in">
      {/* Header */}
      <div className="p-4 border-b border-[var(--bg-tertiary)]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-bold font-display text-[var(--text-primary)]">Clawy Notes</h1>
          <button onClick={() => setSidebarOpen(false)} className="p-1 rounded hover:bg-[var(--bg-tertiary)]">
            <ChevronLeft className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        </div>
        <button
          onClick={() => addNote({ title: 'New Note', content: '# New Note\n\nStart writing...' })}
          className="w-full flex items-center gap-2 px-3 py-2 bg-[var(--accent)] text-white rounded-lg hover:bg-[var(--accent-hover)] transition-colors active-press"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">New Note</span>
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
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
              onClick={() => setActiveNote(note.id)}
              className={`w-full text-left p-2 rounded-lg transition-colors ${
                activeNoteId === note.id
                  ? 'bg-[var(--accent)]/10 border border-[var(--accent)]/20'
                  : 'hover:bg-[var(--bg-tertiary)]'
              }`}
            >
              <div className="flex items-start gap-2">
                {note.isPinned && <Pin className="w-3 h-3 text-[var(--accent)] mt-0.5 flex-shrink-0" />}
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                    {note.title}
                  </p>
                  <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
                    {formatDate(note.updatedAt)}
                  </p>
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
  )
}

// Main Editor Component
function Editor() {
  const { getActiveNote, updateNote, viewMode, setViewMode, deleteNote, pinNote, archiveNote } = useNoteStore()
  const note = getActiveNote()
  const [content, setContent] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (note) {
      setContent(note.content)
    }
  }, [note?.id])

  const handleContentChange = useCallback((newContent: string) => {
    setContent(newContent)
    if (note) {
      const title = extractTitle(newContent)
      updateNote(note.id, { content: newContent, title })
    }
  }, [note, updateNote])

  const handleInsert = (text: string) => {
    const textarea = textareaRef.current
    if (!textarea) return
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newContent = content.slice(0, start) + text + content.slice(end)
    handleContentChange(newContent)
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + text.length, start + text.length)
    }, 0)
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
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--bg-tertiary)]">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold font-display text-[var(--text-primary)]">{note.title}</h2>
          {note.isPinned && <Pin className="w-4 h-4 text-[var(--accent)]" />}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => pinNote(note.id)} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors" title="Pin">
            <Pin className={`w-4 h-4 ${note.isPinned ? 'text-[var(--accent)]' : 'text-[var(--text-tertiary)]'}`} />
          </button>
          <button onClick={() => archiveNote(note.id)} className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors" title="Archive">
            <Archive className="w-4 h-4 text-[var(--text-tertiary)]" />
          </button>
          <button onClick={() => deleteNote(note.id)} className="p-2 rounded-lg hover:bg-red-50 transition-colors" title="Delete">
            <Trash2 className="w-4 h-4 text-[var(--text-tertiary)] hover:text-red-500" />
          </button>
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
      {viewMode !== 'preview' && <Toolbar onInsert={handleInsert} />}

      {/* Editor / Preview */}
      <div className="flex-1 flex overflow-hidden">
        {(viewMode === 'editor' || viewMode === 'split') && (
          <div className={`${viewMode === 'split' ? 'w-1/2' : 'w-full'} h-full`}>
            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="w-full h-full p-4 resize-none bg-[var(--bg-primary)] text-[var(--text-primary)] font-mono text-sm leading-relaxed focus:outline-none"
              placeholder="# Start writing..."
              spellCheck={false}
            />
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
  const { darkMode, toggleDarkMode } = useNoteStore()

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

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
