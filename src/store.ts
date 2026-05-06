import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import type { Note, Folder, Tag, ViewMode } from './types'
import { idbDelete, idbSet, migrateFromLocalStorage } from './db'

// Storage adapter: IndexedDB primary, localStorage mirror as a best-effort
// fallback. On the very first read for a given key we migrate any legacy
// localStorage payload into IndexedDB so existing users keep their notes.
const idbStorage: StateStorage = {
  getItem: async (name) => {
    return await migrateFromLocalStorage(name)
  },
  setItem: async (name, value) => {
    const ok = await idbSet(name, value)
    if (!ok) {
      try {
        localStorage.setItem(name, value)
      } catch {
        // ignore quota / availability errors
      }
      return
    }
    // Mirror to localStorage when it still fits, so a fresh tab can pick
    // notes up synchronously before IDB resolves.
    try {
      localStorage.setItem(name, value)
    } catch {
      // QuotaExceededError or unavailable — IndexedDB remains the truth.
    }
  },
  removeItem: async (name) => {
    await idbDelete(name)
    try {
      localStorage.removeItem(name)
    } catch {
      // ignore
    }
  },
}

interface NoteStore {
  // Data
  notes: Note[]
  folders: Folder[]
  tags: Tag[]
  
  // UI State
  activeNoteId: string | null
  activeFolderId: string | null     // null = "All Notes", '__archive__' = archive view
  sidebarOpen: boolean
  rightSidebarOpen: boolean
  darkMode: boolean
  viewMode: ViewMode
  searchQuery: string
  /**
   * Floating-action-button position. Coordinates are anchored to the
   * bottom-right of the viewport: x = px from right edge, y = px from
   * bottom. Stored across sessions so the FAB stays where the user
   * dropped it.
   */
  fabPosition: { x: number; y: number }
  
  // Actions
  addNote: (note: Partial<Note>) => string
  updateNote: (id: string, updates: Partial<Note>) => void
  deleteNote: (id: string) => void
  pinNote: (id: string) => void
  archiveNote: (id: string) => void
  
  addFolder: (name: string, parentId?: string | null, color?: string) => void
  deleteFolder: (id: string) => void
  
  addTag: (name: string, color?: string) => void
  deleteTag: (id: string) => void
  
  setActiveNote: (id: string | null) => void
  setActiveFolder: (id: string | null) => void
  setSidebarOpen: (open: boolean) => void
  setRightSidebarOpen: (open: boolean) => void
  setFabPosition: (pos: { x: number; y: number }) => void
  toggleDarkMode: () => void
  setViewMode: (mode: ViewMode) => void
  setSearchQuery: (query: string) => void
  
  // Getters
  getActiveNote: () => Note | undefined
  getNotesByFolder: (folderId: string | null) => Note[]
  getNotesByTag: (tagId: string) => Note[]
  getPinnedNotes: () => Note[]
  searchNotes: (query: string) => Note[]

  // Bulk actions for import/export and reset
  replaceData: (data: { notes: Note[]; folders: Folder[]; tags: Tag[] }) => void
  mergeData: (data: { notes: Note[]; folders: Folder[]; tags: Tag[] }) => void
  resetAll: () => void
}

export interface PlumeBackup {
  version: 1
  exportedAt: string
  notes: Note[]
  folders: Folder[]
  tags: Tag[]
}

export function isValidBackup(value: unknown): value is PlumeBackup {
  if (!value || typeof value !== 'object') return false
  const v = value as Partial<PlumeBackup>
  return (
    v.version === 1 &&
    typeof v.exportedAt === 'string' &&
    Array.isArray(v.notes) &&
    Array.isArray(v.folders) &&
    Array.isArray(v.tags)
  )
}

// ─── AI Export ────────────────────────────────────────────────────────────
// A compact, derived representation of the user's notes optimized for fast
// consumption by AI agents (e.g. Claude via MCP). The schema is described
// in PLUME_AI_FORMAT.md. Bumping `format` is a breaking change.

export interface PlumeAINote {
  id: string
  title: string
  /** Folder name or null if untyped. */
  folder: string | null
  tags: string[]              // tag names, not ids
  createdAt: string
  updatedAt: string
  isPinned: boolean
  isArchived: boolean
  content: string
  /** Approx. token count (4 chars / token heuristic). */
  approxTokens: number
  /** Outbound wikilinks ([[Target]]) — note titles, not necessarily existing. */
  outbound: string[]
  /** Inbound wikilinks — titles of notes that reference this one. */
  inbound: string[]
  /** First 280 chars of stripped content for snippet/summary use. */
  snippet: string
}

export interface PlumeAIExport {
  format: 'plume.ai-export.v1'
  exportedAt: string
  app: { name: 'Plume'; version: string }
  stats: {
    notes: number
    folders: number
    tags: number
    approxTokensTotal: number
    wikilinks: number
  }
  folders: { id: string; name: string; color: string; parentId: string | null }[]
  tags: { id: string; name: string; color: string; noteCount: number }[]
  notes: PlumeAINote[]
  graph: {
    nodes: { id: string; title: string }[]
    edges: { from: string; to: string }[]  // by note id
  }
}

const WIKILINK_RE = /\[\[\s*([^\]\n]+?)\s*\]\]/g

function extractWikilinks(content: string): string[] {
  const out: string[] = []
  for (const m of content.matchAll(WIKILINK_RE)) out.push(m[1])
  return out
}

function stripForSnippet(content: string): string {
  return content
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_~`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildAIExport(
  state: { notes: Note[]; folders: Folder[]; tags: Tag[] },
  appVersion = '1.0',
): PlumeAIExport {
  const folderById = new Map(state.folders.map((f) => [f.id, f]))
  const tagById = new Map(state.tags.map((t) => [t.id, t]))
  const titleToId = new Map<string, string>()
  for (const n of state.notes) titleToId.set(n.title.toLowerCase(), n.id)

  const inboundMap = new Map<string, string[]>()
  let edgeCount = 0
  for (const n of state.notes) {
    const out = extractWikilinks(n.content)
    for (const target of out) {
      const targetId = titleToId.get(target.toLowerCase())
      if (!targetId || targetId === n.id) continue
      const arr = inboundMap.get(targetId) ?? []
      arr.push(n.title)
      inboundMap.set(targetId, arr)
      edgeCount++
    }
  }

  const aiNotes: PlumeAINote[] = state.notes.map((n) => {
    const outboundRaw = extractWikilinks(n.content)
    return {
      id: n.id,
      title: n.title,
      folder: n.folderId ? folderById.get(n.folderId)?.name ?? null : null,
      tags: n.tags
        .map((id) => tagById.get(id)?.name)
        .filter((x): x is string => Boolean(x)),
      createdAt: n.createdAt,
      updatedAt: n.updatedAt,
      isPinned: n.isPinned,
      isArchived: n.isArchived,
      content: n.content,
      approxTokens: Math.max(1, Math.round(n.content.length / 4)),
      outbound: Array.from(new Set(outboundRaw)),
      inbound: inboundMap.get(n.id) ?? [],
      snippet: stripForSnippet(n.content).slice(0, 280),
    }
  })

  const tagNoteCounts = new Map<string, number>()
  for (const n of state.notes) {
    for (const tagId of n.tags) {
      tagNoteCounts.set(tagId, (tagNoteCounts.get(tagId) ?? 0) + 1)
    }
  }

  const edges: { from: string; to: string }[] = []
  for (const n of state.notes) {
    for (const target of extractWikilinks(n.content)) {
      const targetId = titleToId.get(target.toLowerCase())
      if (!targetId || targetId === n.id) continue
      edges.push({ from: n.id, to: targetId })
    }
  }

  return {
    format: 'plume.ai-export.v1',
    exportedAt: new Date().toISOString(),
    app: { name: 'Plume', version: appVersion },
    stats: {
      notes: state.notes.length,
      folders: state.folders.length,
      tags: state.tags.length,
      approxTokensTotal: aiNotes.reduce((a, n) => a + n.approxTokens, 0),
      wikilinks: edgeCount,
    },
    folders: state.folders.map((f) => ({
      id: f.id,
      name: f.name,
      color: f.color,
      parentId: f.parentId,
    })),
    tags: state.tags.map((t) => ({
      id: t.id,
      name: t.name,
      color: t.color,
      noteCount: tagNoteCounts.get(t.id) ?? 0,
    })),
    notes: aiNotes,
    graph: {
      nodes: state.notes.map((n) => ({ id: n.id, title: n.title })),
      edges,
    },
  }
}

const generateId = () => crypto.randomUUID()

const defaultFolders: Folder[] = [
  { id: 'inbox', name: 'Inbox', parentId: null, color: '#0ea5e9' },
  { id: 'personal', name: 'Personal', parentId: null, color: '#8b5cf6' },
  { id: 'work', name: 'Work', parentId: null, color: '#f59e0b' },
]

const defaultTags: Tag[] = [
  { id: 'idea', name: 'Idea', color: '#22c55e' },
  { id: 'todo', name: 'Todo', color: '#ef4444' },
  { id: 'draft', name: 'Draft', color: '#a3a3a3' },
]

export const useNoteStore = create<NoteStore>()(
  persist(
    (set, get) => ({
      notes: [],
      folders: defaultFolders,
      tags: defaultTags,
      
      activeNoteId: null,
      activeFolderId: null,
      sidebarOpen: true,
      rightSidebarOpen: true,
      darkMode: false,
      viewMode: 'split',
      searchQuery: '',
      fabPosition: { x: 16, y: 16 },
      
      addNote: (note) => {
        const id = generateId()
        const now = new Date().toISOString()
        // If the caller did not set a folder, drop the note into the
        // currently-viewed folder (when the user has one selected). The
        // archive view is treated as "no folder context" and falls back
        // to inbox so notes don't get archived on creation.
        const state = get()
        const fallbackFolder =
          state.activeFolderId && state.activeFolderId !== '__archive__'
            ? state.activeFolderId
            : 'inbox'
        const newNote: Note = {
          id,
          title: note.title || 'Untitled Note',
          content: note.content || '',
          folderId: note.folderId ?? fallbackFolder,
          tags: note.tags || [],
          createdAt: now,
          updatedAt: now,
          isPinned: false,
          isArchived: false,
        }
        set((s) => ({ notes: [newNote, ...s.notes], activeNoteId: id }))
        return id
      },
      
      updateNote: (id, updates) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, ...updates, updatedAt: new Date().toISOString() } : n
          ),
        }))
      },
      
      deleteNote: (id) => {
        set((state) => ({
          notes: state.notes.filter((n) => n.id !== id),
          activeNoteId: state.activeNoteId === id ? null : state.activeNoteId,
        }))
      },
      
      pinNote: (id) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, isPinned: !n.isPinned } : n
          ),
        }))
      },
      
      archiveNote: (id) => {
        set((state) => ({
          notes: state.notes.map((n) =>
            n.id === id ? { ...n, isArchived: !n.isArchived } : n
          ),
        }))
      },
      
      addFolder: (name, parentId = null, color = '#0ea5e9') => {
        set((state) => ({
          folders: [...state.folders, { id: generateId(), name, parentId, color }],
        }))
      },
      
      deleteFolder: (id) => {
        set((state) => ({
          folders: state.folders.filter((f) => f.id !== id),
          notes: state.notes.map((n) =>
            n.folderId === id ? { ...n, folderId: 'inbox' } : n
          ),
        }))
      },
      
      addTag: (name, color = '#0ea5e9') => {
        set((state) => ({
          tags: [...state.tags, { id: generateId(), name, color }],
        }))
      },
      
      deleteTag: (id) => {
        set((state) => ({
          tags: state.tags.filter((t) => t.id !== id),
          notes: state.notes.map((n) => ({
            ...n,
            tags: n.tags.filter((t) => t !== id),
          })),
        }))
      },
      
      setActiveNote: (id) => set({ activeNoteId: id }),
      setActiveFolder: (id) => set({ activeFolderId: id }),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      setRightSidebarOpen: (open) => set({ rightSidebarOpen: open }),
      setFabPosition: (pos) => set({ fabPosition: pos }),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      setViewMode: (mode) => set({ viewMode: mode }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      getActiveNote: () => {
        const { notes, activeNoteId } = get()
        return notes.find((n) => n.id === activeNoteId)
      },
      
      getNotesByFolder: (folderId) => {
        return get().notes.filter((n) => n.folderId === folderId && !n.isArchived)
      },
      
      getNotesByTag: (tagId) => {
        return get().notes.filter((n) => n.tags.includes(tagId) && !n.isArchived)
      },
      
      getPinnedNotes: () => {
        return get().notes.filter((n) => n.isPinned && !n.isArchived)
      },
      
      searchNotes: (query) => {
        const q = query.toLowerCase()
        return get().notes.filter(
          (n) =>
            !n.isArchived &&
            (n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
        )
      },

      replaceData: ({ notes, folders, tags }) => {
        set({
          notes,
          folders,
          tags,
          activeNoteId: null,
          searchQuery: '',
        })
      },

      mergeData: ({ notes, folders, tags }) => {
        set((state) => {
          const ids = new Set(state.notes.map((n) => n.id))
          const folderIds = new Set(state.folders.map((f) => f.id))
          const tagIds = new Set(state.tags.map((t) => t.id))
          return {
            notes: [...state.notes, ...notes.filter((n) => !ids.has(n.id))],
            folders: [...state.folders, ...folders.filter((f) => !folderIds.has(f.id))],
            tags: [...state.tags, ...tags.filter((t) => !tagIds.has(t.id))],
          }
        })
      },

      resetAll: () => {
        set({
          notes: [],
          folders: defaultFolders,
          tags: defaultTags,
          activeNoteId: null,
          searchQuery: '',
        })
      },
    }),
    {
      name: 'clawy-notes-storage',
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({
        notes: state.notes,
        folders: state.folders,
        tags: state.tags,
        darkMode: state.darkMode,
        sidebarOpen: state.sidebarOpen,
        rightSidebarOpen: state.rightSidebarOpen,
        viewMode: state.viewMode,
        fabPosition: state.fabPosition,
      }),
    }
  )
)
