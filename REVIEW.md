# Plume — Full Review & Bugfix Pass

**Date:** 2026-05-06
**Branch:** `claude/full-review-and-fixes`
**Scope:** Reproduce the reported "text disappears after Enter" bug, then walk every primary user journey end-to-end, list every defect found, fix them, then ship.

---

## P0 — Reported bug

- [x] **Editor: text disappears after Enter.** Fixed in MarkdownEditor via `lastEmittedRef`. Regression tests in `src/MarkdownEditor.test.tsx`.
  - Hypothesis: `MarkdownEditor` syncs `content` prop back into CodeMirror with a `useEffect`. When the user types a character, parent re-renders with the new content, the effect fires, and CM's pending input gets clobbered. Enter triggers a state update + auto-title that round-trips through Zustand → setter → re-render → effect → CM `dispatch({ from: 0, to: docLength, insert: content })` and the in-flight character is lost.

## P1 — Editor smoketests

- [x] Type plain ASCII → Enter → confirm content survives. (covered by MarkdownEditor.test.tsx)
- [x] Type Umlauts (`äöüß`, `Käse`) → Enter → confirm content survives. (regression test)
- [x] Type a numbered list (`1. one`, Enter, `2. two`, Enter, `3. three`) → confirm all lines survive. (regression test)
- [ ] Use the toolbar `Bold` button on a selection → confirm `**…**` is wrapped, content unchanged otherwise.
- [ ] Cmd/Ctrl+B / Cmd/Ctrl+I / Cmd/Ctrl+\` work.
- [ ] Switching between two notes preserves content of both. Cursor doesn't jump.
- [ ] Auto-title from first heading still works when typing.

## P1 — Sidebar smoketests

- [ ] Create folder via the new `Add` button (also via Enter on the input).
- [ ] Create sub-folder by selecting a parent in the dropdown.
- [ ] Create tag via the `Add` button.
- [ ] Collapse Folders / Tags sections, persist across reload.
- [ ] Delete a tag from the chip — note's tag list updates.
- [ ] Delete a folder — its notes fall back to `inbox`.
- [ ] Search filters the notes list. Cmd/Ctrl+K focuses search.
- [ ] Sidebar has a single scroll region; "more below" chevron appears on overflow and disappears at bottom.

## P1 — Note actions smoketests

- [ ] New note → auto-title from first heading.
- [ ] Pin / unpin → pinned notes float to the top.
- [ ] Archive / unarchive (via the Archive folder).
- [ ] Two-step delete confirmation works; first click warns, second deletes.
- [ ] Move-to-folder picker — flat folders + indented sub-folders.
- [ ] Per-note tag picker — toggle on / off.

## P1 — Home / Dashboard smoketests

- [ ] No notes → centered welcome card with `New note` CTA on phone & desktop.
- [ ] Notes exist → Pinned + Recent grid.
- [ ] Click a card → opens the note.
- [ ] Snippet strips frontmatter / fences / wikilinks correctly.

## P2 — Recovery & resilience

- [ ] Crash → fallback UI shows. Reload works. Reset data wipes IDB + LS.
- [ ] `?reset=1` URL escape hatch wipes everything and redirects.
- [ ] Hand-edit storage to introduce malformed note (missing `content` / `updatedAt`) → app stays up, that note's snippet is empty but everything else still works.

## P2 — 3D Graph

- [ ] Open via Quick Actions → camera fits all nodes.
- [ ] At small N the cloud feels packed (not floating apart).
- [ ] Edges are visible against the dark background.
- [ ] Top-N labels are legible, truncated to 22 chars.
- [ ] Click a node → opens the note.

## P2 — Settings & data

- [ ] Export → produces `plume-backup-YYYY-MM-DD.json`.
- [ ] Import (merge) → adds missing notes/folders/tags without dupes.
- [ ] Import (replace) → wipes and restores from backup.
- [ ] Reset all → two-step confirm, clears workspace.

## P2 — PWA / offline

- [ ] Install banner / browser install button works.
- [ ] Reload offline → app shell still renders.

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

---

## Status

- Started: 2026-05-06
- Ended: 2026-05-06
- Tests: 94 → 107 (3 editor round-trip + 10 markdown render regressions)
- Lint: clean
- Build: clean
