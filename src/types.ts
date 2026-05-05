export interface Note {
  id: string
  title: string
  content: string
  folderId: string | null
  tags: string[]
  createdAt: string
  updatedAt: string
  isPinned: boolean
  isArchived: boolean
}

export interface Folder {
  id: string
  name: string
  parentId: string | null
  color: string
}

export interface Tag {
  id: string
  name: string
  color: string
}

export type ViewMode = 'editor' | 'preview' | 'split'
