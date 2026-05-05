# Clawy Notes - Architecture

## Overview
A markdown note editor built for speed, beauty, and offline-first reliability.

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | React 19 + TypeScript | UI layer |
| **Build Tool** | Vite | Fast builds, HMR |
| **Styling** | Tailwind CSS v3 | Utility-first CSS |
| **State** | Zustand + persist | Global state, persisted to `localStorage` |
| **Storage** | `localStorage` today, IndexedDB (Dexie) planned | Notes, folders, tags |
| **Editor** | `<textarea>` today, CodeMirror 6 swap planned | Markdown editing |
| **Preview** | Marked + DOMPurify | Safe HTML rendering |
| **Icons** | Lucide React | Consistent iconography |
| **Deploy** | GitHub Pages (Actions) | Static hosting |

## Design System

### Tone: Editorial/Magazine
- Strong grid, dramatic headlines
- Whitespace as feature
- Notion-like simplicity + Bear-like beauty

### Typography
- **Display:** Space Grotesk (headlines, titles)
- **Body:** Plus Jakarta Sans (content, UI)
- **Mono:** JetBrains Mono (code, editor)

### Color Palette
```css
:root {
  --bg-primary: #fafafa;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e5e5e5;
  --text-primary: #171717;
  --text-secondary: #525252;
  --text-tertiary: #a3a3a3;
  --accent: #0ea5e9;
  --accent-hover: #0284c7;
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
}

.dark {
  --bg-primary: #0a0a0a;
  --bg-secondary: #171717;
  --bg-tertiary: #262626;
  --text-primary: #fafafa;
  --text-secondary: #a3a3a3;
  --text-tertiary: #525252;
  --accent: #38bdf8;
  --accent-hover: #0ea5e9;
}
```

## State Architecture (Zustand)

A single `useNoteStore` holds data and UI state side by side. Editor content
lives on the active `Note` itself — there is no separate editor slice.

```
useNoteStore
├── notes: Note[]
├── folders: Folder[]
├── tags: Tag[]
├── activeNoteId: string | null
├── sidebarOpen: boolean
├── darkMode: boolean
├── viewMode: 'editor' | 'preview' | 'split'
└── searchQuery: string
```

The `persist` middleware writes `notes`, `folders`, `tags`, `darkMode`,
`sidebarOpen`, and `viewMode` to `localStorage` under the key
`clawy-notes-storage`. `activeNoteId` and `searchQuery` are intentionally
session-only.

## Data Models

### Note
```typescript
interface Note {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isArchived: boolean;
}
```

### Folder
```typescript
interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  color: string;
}
```

### Tag
```typescript
interface Tag {
  id: string;
  name: string;
  color: string;
}
```

## Storage Strategy

### Today: `localStorage` via Zustand `persist`
- Key: `clawy-notes-storage`
- Persisted: `notes`, `folders`, `tags`, `darkMode`, `sidebarOpen`, `viewMode`
- Session-only: `activeNoteId`, `searchQuery`

### Planned: IndexedDB (Dexie)
- **Database:** `clawy-notes`
- **Tables:**
  - `notes` - All note content
  - `folders` - Folder hierarchy
  - `tags` - Tag definitions
  - `settings` - User preferences
  - `sync` - Sync metadata

## Component Architecture

Today, `App.tsx` houses the full tree as three components: `Sidebar`,
`Editor`, and the `Toolbar` that the `Editor` renders. Modals are not yet
implemented. The target decomposition once the codebase is split is:

```
App
├── Layout
│   ├── Sidebar
│   │   ├── FolderTree
│   │   ├── TagList
│   │   └── SearchBar
│   └── Main
│       ├── NoteList
│       │   └── NoteCard[]
│       └── Editor
│           ├── Toolbar
│           ├── MarkdownEditor (CodeMirror)
│           └── PreviewPane (Marked)
└── Modals
    ├── Settings
    ├── Export
    └── Import
```

## File Structure

The Stage 2 build is intentionally flat. We will split into folders
(`components/`, `lib/`, `hooks/`) once the surface grows in Stage 3+.

```
src/
├── App.tsx       # Sidebar, editor, preview, top-level layout
├── App.css       # App-specific styling
├── store.ts      # Zustand store: notes, folders, tags, UI state
├── lib.ts        # Markdown rendering, title extraction, date formatting
├── types.ts      # Note, Folder, Tag, ViewMode types
├── index.css     # Tailwind layers + design tokens
├── main.tsx      # React entry point
└── assets/       # Static assets
```

### Target Structure (Stage 3+)

```
src/
├── components/
│   ├── ui/           # Reusable UI components
│   ├── layout/       # Layout components
│   ├── editor/       # Editor components
│   └── modals/       # Modal dialogs
├── stores/
│   ├── noteStore.ts
│   ├── folderStore.ts
│   └── uiStore.ts
├── lib/
│   ├── db.ts         # IndexedDB setup
│   ├── markdown.ts   # Markdown processing
│   └── utils.ts      # Utilities
├── types/
│   └── index.ts      # TypeScript types
├── hooks/
│   ├── useNotes.ts
│   ├── useFolders.ts
│   └── useEditor.ts
└── styles/
    └── index.css     # Global styles + Tailwind
```

## Performance Budget

| Metric | Target |
|--------|--------|
| First Contentful Paint | < 1.5s |
| Time to Interactive | < 3s |
| Bundle Size (gzipped) | < 200KB |
| Lighthouse Score | > 90 |

## Accessibility (A11y)

- WCAG 2.1 AA compliance
- Keyboard navigation
- Screen reader support
- Focus management
- Color contrast 4.5:1 minimum

## Security

- DOMPurify for HTML sanitization
- CSP headers
- No external API calls (offline-first)
- Local data only

## Deployment

### GitHub Pages
- Branch: `gh-pages`
- Build: `npm run build`
- Output: `dist/`
- Custom domain: Optional

### Build Process
1. TypeScript compilation
2. Vite build
3. Asset optimization
4. Deploy to `gh-pages` branch

---

## Stage Plan

### Stage 1: Foundation (Week 1)
- [x] Project setup (Vite, React, TypeScript, Tailwind)
- [x] Design system (tokens, colors, typography)
- [x] Component library (Button, Input, Card, Modal)
- [x] State management (Zustand stores)
- [ ] Storage layer (IndexedDB setup) - currently `localStorage` via Zustand `persist`

### Stage 2: Core Editor (Week 1-2)
- [ ] CodeMirror integration - deps installed, textarea still in use
- [x] Markdown preview (Marked + DOMPurify)
- [x] Basic CRUD (create, read, update, delete notes)
- [x] Auto-save (on every change)
- [ ] Drafts

### Stage 3: Organization (Week 2)
- [ ] Folders (hierarchical) - flat folders shipped
- [x] Tags (read-only, seeded)
- [x] Search (substring across title + content)
- [ ] Filters (pinned, archived, untagged)

### Stage 4: Polish (Week 2-3)
- [x] Dark mode
- [ ] Animations
- [ ] Mobile optimization
- [ ] PWA setup
- [ ] Export (PDF, HTML, MD)

### Stage 5: Launch (Week 3)
- [ ] Testing
- [ ] Documentation
- [x] GitHub Pages deploy (Actions workflow)
- [x] README
- [ ] Open source release

---

*Architecture is the art of how to waste space. — Philip Johnson*
