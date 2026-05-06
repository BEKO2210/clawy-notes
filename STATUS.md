# Plume - Status Report

**Date:** 2026-05-06
**Project:** Plume (Markdown Editor)
**Repo:** https://github.com/BEKO2210/clawy-notes
**Live:** https://clawy-notes.vercel.app and https://beko2210.github.io/clawy-notes/

---

## Completed

### Stage 1 - Foundation
- 50-member team directory, full architecture spec, stage plan
- Vite + React 19 + TypeScript + Tailwind v3
- Editorial design system, CSS variables, dark mode tokens
- Plus Jakarta Sans + Space Grotesk + JetBrains Mono

### Stage 2 - Core Editor
- Zustand store with `persist` (notes, folders, tags, UI state)
- CodeMirror 6 (`lang-markdown`, line wrapping, dark-mode compartment)
- Live markdown preview (Marked + DOMPurify, GFM enabled)
- View modes - editor / split / preview as a segmented control
- CRUD - create, update, pin, archive, delete (with two-step confirm)
- Auto-save on every change, auto-title from first heading
- Dark mode toggle
- GitHub Actions deploy + Vercel deploy (both live, both green)

### Stage 3 - Organization
- Folders (flat, with color-coded markers and counts)
- Tag CRUD UI (create with name + 8-color palette, hover-to-delete chips)
- Per-note tag picker in editor header (popover with checkboxes)
- Tag chips on note cards in the sidebar (up to 3 + overflow count)
- Search (substring across title and content, case-insensitive)
- Archive view (special filter, restore-from-archive flow)

### Stage 4 - Polish
- Mobile drawer (sidebar slides over below 768px, tappable backdrop, auto-close on note pick)
- Lazy-loaded editor with skeleton fallback (~70% smaller initial bundle: 89 kB gzipped)
- Premium logo + wordmark (gradient mark, geometric "p" with feather flourish)
- All 14 markdown commands wrap selection Obsidian-style: bold, italic, strikethrough, inline code, heading, quote, bulleted list, numbered list, checkbox, link, image, code block, table, horizontal rule
- Keymap: Cmd/Ctrl+B, Cmd/Ctrl+I, Cmd/Ctrl+\` inside the editor
- Global shortcuts: Cmd/Ctrl+N (new note), Cmd/Ctrl+K (focus search + open drawer), Esc (close mobile drawer)
- Action buttons (Tag, Pin, Archive) share a unified "tinted accent" active state with `aria-pressed`, `focus-visible:ring`, and `active:scale` press feedback
- Honors `prefers-reduced-motion` across all animations

### Stage 5 - Production Readiness
- React Error Boundary at root (Reload / Try again / Reset data fallback)
- Settings modal with full data portability:
  - Export to `plume-backup-YYYY-MM-DD.json`
  - Import with merge or replace mode + preview screen
  - Reset all (two-step confirm)
- 88 Vitest tests (lib + store + components), all green, ~2 s total
- PWA: manifest.webmanifest + service worker via vite-plugin-pwa
  (offline-capable app shell, autoUpdate registration, Google Fonts cached)
- Renamed brand from "Clawy Notes" to "Plume" (after public-source name check)
- IndexedDB (Dexie) primary persistence with one-shot localStorage migration
  (`src/db.ts` + `idbStorage` adapter in `src/store.ts`)

### Stage 6 - 1.0 Hardening
- Hierarchical folders: `buildFolderTree` / `flattenFolderTree` / `collectDescendantIds`
  helpers in `lib.ts` (cycle-safe, orphan-tolerant), recursive `<FolderTree>`
  component with expand/collapse chevrons, indentation, per-folder note counts,
  and a parent selector in the "New folder" form. The note "Move to" picker
  also renders the same hierarchy.
- Component-level tests with React Testing Library:
  `<FolderTree>` (render, collapse/expand, click handlers),
  `<ErrorBoundary>` (happy path, fallback UI, reset-data confirm flow),
  `<Picker>` (open/close, Esc, outside-click).

---

## Pending / Future

### Nice-to-have
- [ ] Drag-and-drop folder reparenting (current parenting is via the new-folder form)
- [ ] PNG icon variants for stricter Android install banners
- [ ] Per-note Markdown export (right now only full JSON backup)
- [ ] Bundle slimming: split CodeMirror further, lucide-react tree-shake
- [ ] Privacy + about pages
- [ ] Lighthouse / a11y audit pass
- [ ] Real-device mobile QA pass
- [ ] Optional remote sync (CRDT or Yjs)

### Production-readiness: ~95%

What's left for 100%:
1. Lighthouse / a11y audit and a real-device mobile QA pass
2. Trademark clearance (formal, by a lawyer) before any commercial launch
