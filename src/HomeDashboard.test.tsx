import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { HomeDashboard } from './HomeDashboard'
import type { Note, Folder, Tag } from './types'

function mkNote(over: Partial<Note> = {}): Note {
  return {
    id: over.id ?? crypto.randomUUID(),
    title: over.title ?? 'Note',
    content: over.content ?? '',
    folderId: over.folderId ?? null,
    tags: over.tags ?? [],
    createdAt: over.createdAt ?? '2026-05-01T00:00:00.000Z',
    updatedAt: over.updatedAt ?? '2026-05-01T00:00:00.000Z',
    isPinned: over.isPinned ?? false,
    isArchived: over.isArchived ?? false,
  }
}

const folders: Folder[] = [{ id: 'f1', name: 'Inbox', parentId: null, color: '#0ea5e9' }]
const tags: Tag[] = [{ id: 't1', name: 'Idea', color: '#22c55e' }]

describe('<HomeDashboard />', () => {
  it('shows the welcome state when no active notes exist', () => {
    const onNew = vi.fn()
    render(
      <HomeDashboard
        notes={[]}
        folders={folders}
        tags={tags}
        sidebarOpen
        onPick={() => {}}
        onNew={onNew}
      />,
    )
    expect(screen.getByText('Welcome to Plume')).toBeDefined()
    fireEvent.click(screen.getByRole('button', { name: /new note/i }))
    expect(onNew).toHaveBeenCalled()
  })

  it('also shows welcome when every note is archived', () => {
    render(
      <HomeDashboard
        notes={[mkNote({ title: 'Old', isArchived: true })]}
        folders={folders}
        tags={tags}
        sidebarOpen
        onPick={() => {}}
        onNew={() => {}}
      />,
    )
    expect(screen.getByText('Welcome to Plume')).toBeDefined()
  })

  it('renders a grid with pinned notes called out separately', () => {
    const notes = [
      mkNote({ id: '1', title: 'Pinned one', isPinned: true, content: 'Body of pinned.' }),
      mkNote({ id: '2', title: 'Recent one', content: 'Body of recent.' }),
    ]
    render(
      <HomeDashboard
        notes={notes}
        folders={folders}
        tags={tags}
        sidebarOpen
        onPick={() => {}}
        onNew={() => {}}
      />,
    )
    expect(screen.getByText('Pinned')).toBeDefined()
    expect(screen.getByText('Recent')).toBeDefined()
    expect(screen.getByText('Pinned one')).toBeDefined()
    expect(screen.getByText('Recent one')).toBeDefined()
  })

  it('calls onPick when a note card is clicked', () => {
    const onPick = vi.fn()
    const notes = [mkNote({ id: 'note-42', title: 'Pick me', content: 'hello' })]
    render(
      <HomeDashboard
        notes={notes}
        folders={folders}
        tags={tags}
        sidebarOpen
        onPick={onPick}
        onNew={() => {}}
      />,
    )
    fireEvent.click(screen.getByText('Pick me'))
    expect(onPick).toHaveBeenCalledWith('note-42')
  })

  it('strips markdown when rendering snippets', () => {
    const notes = [
      mkNote({
        id: '1',
        title: 'Mark',
        content: '---\ntitle: x\n---\n\n**Bold** and `code` and [link](http://x).',
      }),
    ]
    render(
      <HomeDashboard
        notes={notes}
        folders={folders}
        tags={tags}
        sidebarOpen
        onPick={() => {}}
        onNew={() => {}}
      />,
    )
    const snippet = screen.getByText(/Bold and code and link\.?/i)
    expect(snippet.textContent).not.toContain('**')
    expect(snippet.textContent).not.toContain('`')
    expect(snippet.textContent).not.toContain('[')
  })
})
