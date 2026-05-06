import { ChevronDown, ChevronRight } from 'lucide-react'
import type { FolderNode } from './lib'
import type { Folder as FolderType } from './types'

export interface FolderTreeProps {
  tree: FolderNode<FolderType>[]
  activeFolder: string | null
  collapsed: Set<string>
  counts: Map<string, number>
  onPick: (id: string) => void
  onToggle: (id: string) => void
}

export function FolderTree({
  tree,
  activeFolder,
  collapsed,
  counts,
  onPick,
  onToggle,
}: FolderTreeProps) {
  return (
    <>
      {tree.map((node) => {
        const isOpen = !collapsed.has(node.folder.id)
        const hasChildren = node.children.length > 0
        const isActive = activeFolder === node.folder.id
        const count = counts.get(node.folder.id) ?? 0
        return (
          <div key={node.folder.id}>
            <div
              className={`group w-full flex items-center gap-1 pr-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-[var(--accent)]/10 text-[var(--accent)]'
                  : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)]'
              }`}
              style={{ paddingLeft: `${node.depth * 12}px` }}
            >
              {hasChildren ? (
                <button
                  type="button"
                  onClick={() => onToggle(node.folder.id)}
                  aria-label={isOpen ? `Collapse ${node.folder.name}` : `Expand ${node.folder.name}`}
                  aria-expanded={isOpen}
                  className="flex items-center justify-center w-5 h-5 rounded hover:bg-[var(--bg-tertiary)] text-[var(--text-tertiary)]"
                >
                  {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </button>
              ) : (
                <span className="w-5" aria-hidden="true" />
              )}
              <button
                type="button"
                onClick={() => onPick(node.folder.id)}
                className="flex-1 flex items-center gap-2 px-1 py-1.5 text-left"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: node.folder.color }}
                />
                <span className="truncate">{node.folder.name}</span>
                <span className="ml-auto text-xs text-[var(--text-tertiary)]">{count}</span>
              </button>
            </div>
            {hasChildren && isOpen && (
              <FolderTree
                tree={node.children}
                activeFolder={activeFolder}
                collapsed={collapsed}
                counts={counts}
                onPick={onPick}
                onToggle={onToggle}
              />
            )}
          </div>
        )
      })}
    </>
  )
}
