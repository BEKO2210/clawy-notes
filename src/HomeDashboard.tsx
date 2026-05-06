import { useMemo } from 'react'
import { FileText, Plus, Pin, FolderOpen } from 'lucide-react'
import type { Note, Folder, Tag } from './types'
import { formatDate } from './lib'

const SNIPPET_MAX = 140

function buildSnippet(content: string): string {
  return content
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#*_~`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, SNIPPET_MAX)
}

interface HomeDashboardProps {
  notes: Note[]
  folders: Folder[]
  tags: Tag[]
  sidebarOpen: boolean
  onPick: (id: string) => void
  onNew: () => void
}

export function HomeDashboard({
  notes,
  folders,
  tags,
  sidebarOpen,
  onPick,
  onNew,
}: HomeDashboardProps) {
  const folderById = useMemo(() => new Map(folders.map((f) => [f.id, f])), [folders])
  const tagById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])

  const active = useMemo(() => notes.filter((n) => !n.isArchived), [notes])
  const pinned = useMemo(() => active.filter((n) => n.isPinned), [active])
  const recent = useMemo(
    () =>
      [...active]
        .filter((n) => !n.isPinned)
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [active],
  )

  if (active.length === 0) {
    return (
      <div className={`flex-1 flex items-center justify-center bg-[var(--bg-primary)] ${sidebarOpen ? '' : 'pl-12'}`}>
        <div className="text-center max-w-sm px-6">
          <FileText className="w-12 h-12 text-[var(--text-tertiary)] mx-auto mb-3" />
          <p className="text-lg font-medium text-[var(--text-secondary)]">Welcome to Plume</p>
          <p className="text-sm text-[var(--text-tertiary)] mt-1 mb-5">
            Create your first markdown note to get started.
          </p>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            New note
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className={`flex-1 overflow-y-auto bg-[var(--bg-primary)] ${sidebarOpen ? 'pt-4' : 'pt-16'} pb-10`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl sm:text-2xl font-display font-bold tracking-tight text-[var(--text-primary)]">
              All notes
            </h2>
            <p className="text-xs text-[var(--text-tertiary)] mt-0.5">
              {active.length} note{active.length === 1 ? '' : 's'} ·{' '}
              {folders.length} folder{folders.length === 1 ? '' : 's'} · {tags.length} tag
              {tags.length === 1 ? '' : 's'}
            </p>
          </div>
          <button
            type="button"
            onClick={onNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:bg-[var(--accent-hover)] active:scale-[0.98] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">New</span>
          </button>
        </div>

        {pinned.length > 0 && (
          <section className="mb-6">
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2 flex items-center gap-1.5">
              <Pin className="w-3 h-3" />
              Pinned
            </h3>
            <NoteGrid
              notes={pinned}
              folderById={folderById}
              tagById={tagById}
              onPick={onPick}
            />
          </section>
        )}

        <section>
          <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary)] mb-2">
            Recent
          </h3>
          {recent.length === 0 ? (
            <p className="text-sm text-[var(--text-tertiary)]">Nothing else yet.</p>
          ) : (
            <NoteGrid
              notes={recent}
              folderById={folderById}
              tagById={tagById}
              onPick={onPick}
            />
          )}
        </section>
      </div>
    </div>
  )
}

function NoteGrid({
  notes,
  folderById,
  tagById,
  onPick,
}: {
  notes: Note[]
  folderById: Map<string, Folder>
  tagById: Map<string, Tag>
  onPick: (id: string) => void
}) {
  return (
    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {notes.map((n) => {
        const folder = n.folderId ? folderById.get(n.folderId) : null
        const snippet = buildSnippet(n.content)
        return (
          <li key={n.id}>
            <button
              type="button"
              onClick={() => onPick(n.id)}
              className="group w-full text-left p-3.5 rounded-xl border border-[var(--bg-tertiary)] bg-[var(--bg-secondary)] hover:border-[var(--accent)]/40 hover:bg-[var(--bg-tertiary)]/50 active:scale-[0.99] transition-all"
            >
              <div className="flex items-start justify-between gap-2 mb-1.5">
                <h4 className="text-sm font-semibold text-[var(--text-primary)] truncate flex-1">
                  {n.title || 'Untitled'}
                </h4>
                {n.isPinned && <Pin className="w-3 h-3 text-[var(--accent)] flex-shrink-0 mt-0.5" />}
              </div>
              {snippet ? (
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed line-clamp-2 mb-2">
                  {snippet}
                </p>
              ) : (
                <p className="text-xs text-[var(--text-tertiary)] italic mb-2">Empty note</p>
              )}
              <div className="flex items-center gap-2 text-[11px] text-[var(--text-tertiary)] flex-wrap">
                {folder && (
                  <span className="inline-flex items-center gap-1">
                    <FolderOpen className="w-3 h-3" style={{ color: folder.color }} />
                    {folder.name}
                  </span>
                )}
                <span>{formatDate(n.updatedAt)}</span>
                {n.tags.slice(0, 3).map((tagId) => {
                  const tag = tagById.get(tagId)
                  if (!tag) return null
                  return (
                    <span
                      key={tagId}
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                      style={{ backgroundColor: tag.color + '22', color: tag.color }}
                    >
                      {tag.name}
                    </span>
                  )
                })}
                {n.tags.length > 3 && (
                  <span className="text-[10px]">+{n.tags.length - 3}</span>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
