import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Note, Folder, Tag, ViewMode } from './types'

interface NoteStore {
  // Data
  notes: Note[]
  folders: Folder[]
  tags: Tag[]
  
  // UI State
  activeNoteId: string | null
  sidebarOpen: boolean
  darkMode: boolean
  viewMode: ViewMode
  searchQuery: string
  
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
  setSidebarOpen: (open: boolean) => void
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
      sidebarOpen: true,
      darkMode: false,
      viewMode: 'split',
      searchQuery: '',
      
      addNote: (note) => {
        const id = generateId()
        const now = new Date().toISOString()
        const newNote: Note = {
          id,
          title: note.title || 'Untitled Note',
          content: note.content || '',
          folderId: note.folderId || 'inbox',
          tags: note.tags || [],
          createdAt: now,
          updatedAt: now,
          isPinned: false,
          isArchived: false,
        }
        set((state) => ({ notes: [newNote, ...state.notes], activeNoteId: id }))
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
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
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
      partialize: (state) => ({
        notes: state.notes,
        folders: state.folders,
        tags: state.tags,
        darkMode: state.darkMode,
        sidebarOpen: state.sidebarOpen,
        viewMode: state.viewMode,
      }),
    }
  )
)
