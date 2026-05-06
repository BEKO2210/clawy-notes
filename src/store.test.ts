import { describe, it, expect, beforeEach } from 'vitest'
import { buildAIExport, isValidBackup, useNoteStore } from './store'

function freshStore() {
  // Reset to a known empty state with default folders/tags
  useNoteStore.getState().resetAll()
}

describe('useNoteStore', () => {
  beforeEach(() => {
    freshStore()
  })

  describe('addNote', () => {
    it('creates a note with the given fields and activates it', () => {
      const id = useNoteStore.getState().addNote({ title: 'Hello', content: '# Hello' })
      const state = useNoteStore.getState()
      const note = state.notes.find((n) => n.id === id)
      expect(note).toBeDefined()
      expect(note?.title).toBe('Hello')
      expect(note?.content).toBe('# Hello')
      expect(state.activeNoteId).toBe(id)
    })

    it('falls back to defaults when fields are omitted', () => {
      const id = useNoteStore.getState().addNote({})
      const note = useNoteStore.getState().notes.find((n) => n.id === id)
      expect(note?.title).toBe('Untitled Note')
      expect(note?.folderId).toBe('inbox')
      expect(note?.isPinned).toBe(false)
      expect(note?.isArchived).toBe(false)
    })

    it('puts the new note at the top of the list', () => {
      const first = useNoteStore.getState().addNote({ title: 'first' })
      const second = useNoteStore.getState().addNote({ title: 'second' })
      const ids = useNoteStore.getState().notes.map((n) => n.id)
      expect(ids[0]).toBe(second)
      expect(ids[1]).toBe(first)
    })
  })

  describe('updateNote', () => {
    it('mutates fields and refreshes updatedAt', () => {
      const id = useNoteStore.getState().addNote({ title: 'old' })
      // Stamp the note as a minute old so the new updatedAt is unambiguously newer.
      const earlier = new Date(Date.now() - 60_000).toISOString()
      useNoteStore.setState((s) => ({
        notes: s.notes.map((n) => (n.id === id ? { ...n, updatedAt: earlier } : n)),
      }))
      useNoteStore.getState().updateNote(id, { title: 'new' })
      const note = useNoteStore.getState().notes.find((n) => n.id === id)
      expect(note?.title).toBe('new')
      expect(note?.updatedAt).not.toBe(earlier)
    })
  })

  describe('deleteNote', () => {
    it('removes the note and clears activeNoteId if it was active', () => {
      const id = useNoteStore.getState().addNote({ title: 'doomed' })
      useNoteStore.getState().deleteNote(id)
      const state = useNoteStore.getState()
      expect(state.notes.find((n) => n.id === id)).toBeUndefined()
      expect(state.activeNoteId).toBeNull()
    })
  })

  describe('pinNote / archiveNote', () => {
    it('toggles flags', () => {
      const id = useNoteStore.getState().addNote({})
      useNoteStore.getState().pinNote(id)
      expect(useNoteStore.getState().notes[0].isPinned).toBe(true)
      useNoteStore.getState().pinNote(id)
      expect(useNoteStore.getState().notes[0].isPinned).toBe(false)
      useNoteStore.getState().archiveNote(id)
      expect(useNoteStore.getState().notes[0].isArchived).toBe(true)
    })
  })

  describe('getters', () => {
    it('searchNotes is case-insensitive across title and content, skips archived', () => {
      useNoteStore.getState().addNote({ title: 'Apples', content: 'fresh' })
      const id = useNoteStore.getState().addNote({ title: 'archive me', content: 'apples' })
      useNoteStore.getState().archiveNote(id)
      const results = useNoteStore.getState().searchNotes('APPLE')
      expect(results.map((n) => n.title)).toEqual(['Apples'])
    })

    it('getPinnedNotes only returns pinned non-archived notes', () => {
      const a = useNoteStore.getState().addNote({ title: 'a' })
      useNoteStore.getState().addNote({ title: 'b' })
      useNoteStore.getState().pinNote(a)
      const pinned = useNoteStore.getState().getPinnedNotes()
      expect(pinned).toHaveLength(1)
      expect(pinned[0].id).toBe(a)
    })
  })

  describe('addTag / deleteTag', () => {
    it('adds a tag and removes it from notes when deleted', () => {
      useNoteStore.getState().addTag('Project', '#0ea5e9')
      const tag = useNoteStore.getState().tags.find((t) => t.name === 'Project')!
      const noteId = useNoteStore.getState().addNote({ tags: [tag.id] })
      expect(useNoteStore.getState().notes[0].tags).toContain(tag.id)
      useNoteStore.getState().deleteTag(tag.id)
      expect(useNoteStore.getState().tags.find((t) => t.id === tag.id)).toBeUndefined()
      expect(useNoteStore.getState().notes.find((n) => n.id === noteId)?.tags).not.toContain(tag.id)
    })
  })

  describe('replaceData / mergeData', () => {
    it('replaces fully', () => {
      useNoteStore.getState().addNote({ title: 'will be wiped' })
      useNoteStore.getState().replaceData({ notes: [], folders: [], tags: [] })
      const state = useNoteStore.getState()
      expect(state.notes).toEqual([])
      expect(state.folders).toEqual([])
      expect(state.tags).toEqual([])
      expect(state.activeNoteId).toBeNull()
    })

    it('merges by id and skips duplicates', () => {
      const id = useNoteStore.getState().addNote({ title: 'keep me' })
      const existing = useNoteStore.getState().notes[0]
      useNoteStore.getState().mergeData({
        notes: [existing, { ...existing, id: 'new-id', title: 'new one' }],
        folders: [],
        tags: [],
      })
      const state = useNoteStore.getState()
      expect(state.notes).toHaveLength(2)
      expect(state.notes.find((n) => n.id === id)?.title).toBe('keep me')
      expect(state.notes.find((n) => n.id === 'new-id')?.title).toBe('new one')
    })
  })
})

describe('buildAIExport', () => {
  beforeEach(() => {
    useNoteStore.getState().resetAll()
  })

  it('emits the v1 format envelope and stats', () => {
    useNoteStore.getState().addNote({ title: 'Hello', content: 'A simple note.' })
    const ex = buildAIExport({
      notes: useNoteStore.getState().notes,
      folders: useNoteStore.getState().folders,
      tags: useNoteStore.getState().tags,
    })
    expect(ex.format).toBe('plume.ai-export.v1')
    expect(ex.stats.notes).toBe(1)
    expect(ex.stats.approxTokensTotal).toBeGreaterThan(0)
    expect(ex.notes[0].title).toBe('Hello')
    expect(ex.notes[0].folder).toBe('Inbox')
    expect(ex.notes[0].snippet).toContain('A simple note')
  })

  it('resolves outbound + inbound wikilinks by title', () => {
    useNoteStore.getState().addNote({ title: 'A', content: 'See [[B]] and [[C]].' })
    useNoteStore.getState().addNote({ title: 'B', content: 'Back to [[A]].' })
    useNoteStore.getState().addNote({ title: 'C', content: 'Standalone.' })
    const { notes, folders, tags } = useNoteStore.getState()
    const ex = buildAIExport({ notes, folders, tags })
    const a = ex.notes.find((n) => n.title === 'A')!
    const b = ex.notes.find((n) => n.title === 'B')!
    expect(a.outbound).toEqual(expect.arrayContaining(['B', 'C']))
    expect(a.inbound).toEqual(['B'])
    expect(b.outbound).toEqual(['A'])
    expect(b.inbound).toEqual(['A'])
    // Edges in the graph (from / to are note ids)
    expect(ex.graph.edges.length).toBe(3)
  })

  it('counts notes per tag', () => {
    useNoteStore.getState().addTag('Work', '#0ea5e9')
    const tagId = useNoteStore.getState().tags.find((t) => t.name === 'Work')!.id
    useNoteStore.getState().addNote({ tags: [tagId] })
    useNoteStore.getState().addNote({ tags: [tagId] })
    useNoteStore.getState().addNote({})
    const { notes, folders, tags } = useNoteStore.getState()
    const ex = buildAIExport({ notes, folders, tags })
    const work = ex.tags.find((t) => t.name === 'Work')!
    expect(work.noteCount).toBe(2)
  })

  it('snippets strip frontmatter, fences, links, and markdown punctuation', () => {
    useNoteStore.getState().addNote({
      title: 'Demo',
      content: '---\ntitle: x\n---\n\n**Hello** and [[Other]] and `code`.',
    })
    const ex = buildAIExport({
      notes: useNoteStore.getState().notes,
      folders: useNoteStore.getState().folders,
      tags: useNoteStore.getState().tags,
    })
    const demo = ex.notes.find((n) => n.title === 'Demo')!
    expect(demo.snippet).not.toContain('---')
    expect(demo.snippet).not.toContain('**')
    expect(demo.snippet).not.toContain('[[')
    expect(demo.snippet).toContain('Hello')
    expect(demo.snippet).toContain('Other')
  })
})

describe('isValidBackup', () => {
  it('accepts a well-formed backup', () => {
    expect(
      isValidBackup({
        version: 1,
        exportedAt: new Date().toISOString(),
        notes: [],
        folders: [],
        tags: [],
      }),
    ).toBe(true)
  })

  it('rejects wrong shapes', () => {
    expect(isValidBackup(null)).toBe(false)
    expect(isValidBackup({})).toBe(false)
    expect(isValidBackup({ version: 2, exportedAt: '', notes: [], folders: [], tags: [] })).toBe(false)
    expect(isValidBackup({ version: 1, exportedAt: new Date().toISOString(), notes: 'oops' })).toBe(false)
  })
})
