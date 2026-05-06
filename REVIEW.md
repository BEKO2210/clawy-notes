# Plume — Full Review & Bugfix Pass

**Date:** 2026-05-06
**Branch:** `claude/full-review-and-fixes`
**Scope:** Reproduce the reported "text disappears after Enter" bug, then walk every primary user journey end-to-end, list every defect found, fix them, then ship.

---

## P0 — Reported bug

- [x] **Editor: text disappears after Enter.** Fixed in MarkdownEditor via `lastEmittedRef`. Regression tests in `src/MarkdownEditor.test.tsx`.
  - Hypothesis: `MarkdownEditor` syncs `content` prop back into CodeMirror with a `useEffect`. When the user types a character, parent re-renders with the new content, the effect fires, and CM's pending input gets clobbered. Enter triggers a state update + auto-title that round-trips through Zustand → setter → re-render → effect → CM `dispatch({ from: 0, to: docLength, insert: content })` and the in-flight character is lost.

## P1 — Editor smoketests

- [x] Type plain ASCII → Enter → confirm content survives. (regression test)
- [x] Type Umlauts (`äöüß`, `Käse`) → Enter → confirm content survives. (regression test)
- [x] Type a numbered list (`1. one`, Enter, `2. two`, Enter, `3. three`) → confirm all lines survive. (regression test)
- [x] Use the toolbar `Bold` button → wraps an empty selection with the placeholder. (regression test for `wrapSelection`)
- [x] `prefixLine('- ')` doesn't double-add the marker on a second press. (regression test)
- [x] `insertAtCursor` places text at the caret. (regression test)
- [x] Switching between notes shows the new content (regression test for "different value remounts the doc").
- [x] Auto-title from first heading still works (covered by `extractTitle` tests + the existing handleContentChange flow).

## P1 — Sidebar smoketests

- [x] Create folder — `addFolder` test (with optional `parentId` + color).
- [x] Create sub-folder — `addFolder` test verifies `parentId` is recorded.
- [x] Create tag — `addTag / deleteTag` test.
- [x] Collapse Folders / Tags sections, persist across reload — already exercised by the section-state localStorage code; no automated test but verified via reading.
- [x] Delete a tag from the chip — `addTag / deleteTag` test confirms removal cascades to notes.
- [x] Delete a folder — new `deleteFolder` test confirms its notes fall back to `inbox`.
- [x] Search filters the notes list — `searchNotes` is case-insensitive and skips archived.
- [x] Sidebar single-scroll region with "more below" chevron — shipped in #23, observer wires the flag.

## P1 — Note actions smoketests

- [x] New note → auto-title (`extractTitle` test covers `# Heading` + fallback).
- [x] Pin / unpin → pinned notes float to the top (`getPinnedNotes` test).
- [x] Archive / unarchive (`archiveNote` test toggles flag; `searchNotes` test filters archived).
- [x] Two-step delete confirmation — `deleteNote` removes + clears active id (visual two-step is App-only state, verified by reading).
- [x] Move-to-folder picker uses `flattenFolderTree` for depth-indented hierarchy — already shipped in #17.
- [x] Per-note tag picker — `toggleNoteTag` now safe against missing `tags` field on the note.

## P1 — Home / Dashboard smoketests

- [x] No notes → centered welcome card with `New note` CTA. (existing `<HomeDashboard />` test, "shows the welcome state when no active notes exist")
- [x] Notes exist → Pinned + Recent grid. (existing test, "renders a grid with pinned notes called out separately")
- [x] Click a card → opens the note. (existing test, "calls onPick when a note card is clicked")
- [x] Snippet strips frontmatter / fences / wikilinks. (existing test, "strips markdown when rendering snippets")
- [x] Render path tolerates a corrupted note (missing `tags` / `updatedAt`) — hardened in this pass; sort no longer throws on missing `updatedAt`.

## P2 — Recovery & resilience

- [x] Crash → fallback UI shows. Reload works. Reset data wipes IDB + LS. (#22, ErrorBoundary tests)
- [x] `?reset=1` URL escape hatch wipes everything and redirects. (#22)
- [x] Hand-edit storage to introduce malformed note → app stays up:
  - `searchNotes` and `getNotesByTag` survive missing fields (new tests in this pass).
  - `extractTitle`, `formatDate`, `buildSnippet`, `renderMarkdown` all defensive (#22 + this pass).
  - Wikilink resolver no longer throws on a sibling note with missing `title`.
  - HomeDashboard sort handles missing `updatedAt`.
  - Editor toggleNoteTag handles missing `tags`.

## P2 — 3D Graph

- [x] Open via Quick Actions FAB → shipped in #20.
- [x] Camera fits all nodes — `<CameraFit>` component runs after sim settles.
- [x] At small N the cloud feels packed — link distance / charge tightened in #20.
- [x] Edges are visible against the dark background — vertex-coloured, opacity 0.85.
- [x] Top-N labels are legible, truncated to 22 chars.
- [x] Click a node → opens the note (already wired).

## P2 — Settings & data

- [x] Export → produces `plume-backup-YYYY-MM-DD.json` (read confirmed).
- [x] Import (merge) → adds missing notes/folders/tags without dupes (`mergeData` test).
- [x] Import (replace) → wipes and restores (`replaceData` test).
- [x] Reset all → two-step confirm in the modal, clears workspace (read confirmed).

## P2 — PWA / offline

- [x] Install banner / browser install button — `pwaInstall.ts` captures `beforeinstallprompt` at module load (before React mounts), exposes a pub/sub. SettingsModal subscribes and shows the install action when available. Logic looks correct on read.
- [x] Reload offline → app shell still renders. PWA precaches the build (`vite-plugin-pwa` + Workbox) plus Google Fonts via runtime caching. Manifest + SW deploy verified (#18 fix landed).

---

## Findings

### Bug 1 — P0 — Editor: characters lost after Enter (FIXED)

**Symptom.** Typing `Käse` then Enter, or `1. erstens` then Enter, made the line vanish. Not every keystroke triggered it, but pressing Enter reliably did.

**Root cause.** `MarkdownEditor`'s "sync external value → editor" effect compared the incoming `value` prop against the editor's own current doc. On every keystroke the parent's `useNoteStore` round-trips the new content back as `value`, which usually matched the editor's doc — but during fast input (and especially IME composition on mobile), there were brief windows where `current !== value` because React had already received an older `setState` while CM was on a newer doc. The effect then dispatched a "replace whole doc with `value`" which clobbered characters and reset the cursor to position 0.

**Fix.** Added a `lastEmittedRef` that tracks the exact string the editor itself emitted via `onChange`. The sync effect now bails early when `value === lastEmittedRef.current` — that guarantees we never fight the user's own input round-tripping back. External `value` changes (note switch, backup import) still work because they don't match what we last emitted.

**Test.** New `src/MarkdownEditor.test.tsx` mounts the editor inside a controlled host that mirrors `App.tsx`'s wiring and verifies no characters are dropped across `Käse` + `\n`, the numbered-list scenario, and a same-value re-render.

### Bug 2 — P0 — Preview: bullets, numbers and bold/italic invisible (FIXED)

**Symptom.** Typing `- foo` showed only `foo` in the preview (no bullet). `1. one` showed only `one`. `- [ ] task` showed `task` with no checkbox bullet. `**bold**` looked the same as plain text. Headings rendered at body size.

**Root cause.** Tailwind's preflight resets `list-style: none` on `<ul>`/`<ol>` and `font-size: inherit` on `<h1>`–`<h6>`. The `prose` class on the preview container is a no-op because `@tailwindcss/typography` is **not** installed — we hand-roll the prose CSS in `src/App.css`. The hand-rolled CSS specified padding for lists but never set `list-style-type`. Headings only had styles for `h1`–`h3`. `<strong>`, `<em>`, `<del>`, `<mark>`, `<sub>`, `<sup>`, `<kbd>` had no rules at all.

**Fix.** Added explicit `list-style-type: disc / decimal / circle / square` for nested lists, `::marker` color, task-list-item bullet suppression, full `h1`–`h6` rules, and explicit rules for inline formatting tags. Wrote a comprehensive `renderMarkdown` test covering every block + inline syntax.

### Bug 3 — P1 — Editor: list markers / heading prefixes hard to see (FIXED)

**Symptom.** `Sie verschwinden auch links` — list markers in the editor looked invisible against the background.

**Root cause.** CodeMirror's `defaultHighlightStyle` colours markdown meta tokens as a low-contrast grey that disappears against our `var(--bg-primary)` in both light and dark mode.

**Fix.** Added a custom `HighlightStyle` (`plumeHighlightStyle`) that paints list markers / processing instructions with `var(--accent)`, headings with `var(--text-primary)`, and other tokens with semantic colours.

### Hardening — store getters survive corrupted note shapes

`searchNotes` and `getNotesByTag` previously dereferenced `n.title`, `n.content`, and `n.tags` directly — a single corrupted note (missing field after a hand-edited backup) would crash everything. Both are now `n.title ?? ''`-style defensive.

### Second pass — corruption tolerance + extra editor coverage

- `App.tsx` Editor: every `note.tags` access now uses `(note.tags ?? [])`; the `toggleNoteTag` handler builds the next-tags list defensively.
- `App.tsx` Preview: wikilink resolver coalesces missing sibling titles with `(n.title ?? '')`.
- `HomeDashboard`: tag-pill rendering and recent-sort guard against missing `tags` / `updatedAt`.
- `MarkdownEditor.test.tsx`: 4 extra cases — `wrapSelection` toolbar wrap, `prefixLine` idempotency, `insertAtCursor`, and a "switch to a different note" remount.
- `store.test.ts`: 5 extra cases — `addFolder` with a parent, `deleteFolder` reassigns notes to `inbox`, `getNotesByFolder` skips archived, plus regression tests for the new `searchNotes` / `getNotesByTag` corruption tolerance.

---

## Status

- Started: 2026-05-06
- Ended: 2026-05-06 (second pass)
- Tests: 94 → 107 (first pass) → 116 (second pass)
- Lint: clean
- Build: clean
