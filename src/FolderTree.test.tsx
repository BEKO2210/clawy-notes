import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { FolderTree } from './FolderTree'
import { buildFolderTree } from './lib'
import type { Folder } from './types'

const mkFolder = (id: string, name: string, parentId: string | null = null): Folder => ({
  id,
  name,
  parentId,
  color: '#0ea5e9',
})

describe('<FolderTree />', () => {
  it('renders a flat list of folders with their note counts', () => {
    const folders = [mkFolder('a', 'Inbox'), mkFolder('b', 'Work')]
    render(
      <FolderTree
        tree={buildFolderTree(folders)}
        activeFolder={null}
        collapsed={new Set()}
        counts={new Map([['a', 3]])}
        onPick={() => {}}
        onToggle={() => {}}
      />,
    )
    expect(screen.getByText('Inbox')).toBeDefined()
    expect(screen.getByText('Work')).toBeDefined()
    expect(screen.getByText('3')).toBeDefined()
  })

  it('shows expand/collapse buttons for parents and hides children when collapsed', () => {
    const folders = [mkFolder('root', 'Root'), mkFolder('child', 'Child', 'root')]
    const { rerender } = render(
      <FolderTree
        tree={buildFolderTree(folders)}
        activeFolder={null}
        collapsed={new Set()}
        counts={new Map()}
        onPick={() => {}}
        onToggle={() => {}}
      />,
    )
    expect(screen.getByText('Child')).toBeDefined()
    expect(screen.getByLabelText('Collapse Root')).toBeDefined()

    rerender(
      <FolderTree
        tree={buildFolderTree(folders)}
        activeFolder={null}
        collapsed={new Set(['root'])}
        counts={new Map()}
        onPick={() => {}}
        onToggle={() => {}}
      />,
    )
    expect(screen.queryByText('Child')).toBeNull()
    expect(screen.getByLabelText('Expand Root')).toBeDefined()
  })

  it('fires onPick when the folder body is clicked and onToggle for the chevron', () => {
    const folders = [mkFolder('root', 'Root'), mkFolder('child', 'Child', 'root')]
    const onPick = vi.fn()
    const onToggle = vi.fn()
    render(
      <FolderTree
        tree={buildFolderTree(folders)}
        activeFolder={null}
        collapsed={new Set()}
        counts={new Map()}
        onPick={onPick}
        onToggle={onToggle}
      />,
    )
    fireEvent.click(screen.getByText('Child'))
    expect(onPick).toHaveBeenCalledWith('child')

    fireEvent.click(screen.getByLabelText('Collapse Root'))
    expect(onToggle).toHaveBeenCalledWith('root')
  })
})
