<div align="center">

<img src="public/logo.svg" alt="Plume" width="80" height="80" />

# Plume

**A fast, beautiful, offline-first markdown notes app — agent-ready by design.**

[Live (Vercel)][demo-vercel]&nbsp; · &nbsp;[Live (GitHub Pages)][demo-gh]&nbsp; · &nbsp;[License](./LICENSE)&nbsp; · &nbsp;[AI export format](./PLUME_AI_FORMAT.md)

[demo-vercel]: https://clawy-notes.vercel.app
[demo-gh]: https://beko2210.github.io/clawy-notes/

</div>

---

Plume is a local-first markdown editor in the spirit of Obsidian — all your
notes stay in **your** browser, in IndexedDB, behind your own backups. It is
built on React 19, ships as a PWA, weighs about **89 kB gzipped on first
paint**, and exposes a first-class **AI export format** so Claude or any other
agent can ingest your vault without re-parsing a single byte of markdown.

## Why Plume

- **Local-first.** No accounts, no servers, no telemetry. Notes live in
  IndexedDB; export to JSON whenever you like.
- **Markdown is markdown.** Standard CommonMark + GFM, plus the Obsidian
  extensions you actually reach for (highlight, sup/sub, wikilinks, callouts,
  tasks, KaTeX, Mermaid, frontmatter).
- **Agent-friendly.** A versioned `plume.ai-export.v1` JSON format with
  pre-resolved backlinks, snippets, and a graph — designed to be the cheap
  side of an agent's RAG pipeline.
- **Premium UI without the desktop weight.** Lazy editor, lazy math, lazy
  graph. Nothing in your way until you open it.
- **Mobile-first, not mobile-tolerated.** Slide-over drawer, bottom-sheet
  pickers, draggable FAB, install prompt for the PWA in Settings.
- **Honest engineering.** 72 Vitest unit tests, full XSS hardening, Error
  Boundary at the root, every interactive surface keyboard-reachable.

---

## Feature matrix

### Editor

| | |
|---|---|
| ✅ | CodeMirror 6 with `lang-markdown`, line wrapping, dark-mode compartment |
| ✅ | Live preview (Marked + DOMPurify, GFM enabled) |
| ✅ | Editor / Split / Preview as a segmented control |
| ✅ | Toolbar with 14 commands — wraps the **selection** like Obsidian, never dumps placeholder text |
| ✅ | YAML frontmatter rendered as a styled "Properties" block |
| ✅ | Code blocks: language label + Copy button |
| ✅ | Interactive task checkboxes — click in the preview to toggle |
| ✅ | Wikilinks `[[Note]]`: jump to the note, or click a ghost link to create it |

### Markdown extensions

| Syntax | Renders |
|---|---|
| `**bold**` `*italic*` `~~strike~~` `\`code\`` | Standard inline |
| `==highlight==` | `<mark>` (yellow) |
| `^sup^` `~sub~` | Superscript / subscript |
| `# H1` … `###### H6` | Six heading levels |
| `> quote` | Blockquote (nested OK) |
| `> [!info]` … `> [!danger]` | 10 callout variants, `+` / `-` makes them collapsible |
| `[[Title]]` | Wikilink — colour-coded existing vs. ghost |
| `- [ ]` `- [x]` | Task lists, click in preview to toggle |
| `\| col \| col \|` | GFM tables with alignment |
| `\`\`\`lang` | Fenced code with copy button + language label |
| `\`\`\`mermaid` | Lazy-loaded Mermaid diagrams (light + dark themes) |
| `$x$` `$$ x $$` | Lazy-loaded KaTeX inline + block math |
| `---` frontmatter `---` | YAML frontmatter at the very top of a note |

### Workspace

| | |
|---|---|
| ✅ | **Mobile drawer** — slide-over sidebar with backdrop on phones |
| ✅ | **Right sidebar (lg+)** — outline (auto from headings) + backlinks |
| ✅ | **Command palette** — `Cmd/Ctrl+P`, fuzzy search across notes & commands |
| ✅ | **3D graph view** — `Cmd/Ctrl+G`, react-three-fiber + d3-force-3d |
| ✅ | **Folders** — flat (Inbox / Personal / Work + your own), color-coded |
| ✅ | **Tags** — full CRUD, 8-color palette, chip rendering on note cards |
| ✅ | **Archive view** — dedicated filter, restore-from-archive |
| ✅ | **Pin / Archive / Delete** with two-step destructive confirm |
| ✅ | **Search** — substring across title and content |
| ✅ | **Audit page** — `?audit=1` runs 30+ live checks against the renderer |

### Data

| | |
|---|---|
| ✅ | IndexedDB primary, localStorage fallback |
| ✅ | Transparent migration from legacy localStorage |
| ✅ | Export / Import JSON backup (with merge or replace) |
| ✅ | **Export for AI** — `plume.ai-export.v1` with backlinks, snippets, graph |
| ✅ | Reset all (two-step confirm) |
| ✅ | React Error Boundary at root with safe data-wipe option |

### Mobile

| | |
|---|---|
| ✅ | Floating action button — draggable anywhere on screen, position persisted |
| ✅ | One-tap "close all overlays" on the FAB X |
| ✅ | Bottom-sheet pickers (Tag, Folder, Quick Actions) on small screens |
| ✅ | PWA install prompt surfaced in Settings when offered |
| ✅ | Service worker (vite-plugin-pwa) — works offline after first visit |
| ✅ | `safe-area-inset-bottom` aware FAB and bottom sheets |

### Accessibility

| | |
|---|---|
| ✅ | `prefers-reduced-motion` honored across every animation |
| ✅ | `focus-visible:ring` on all interactive surfaces |
| ✅ | `aria-label`, `aria-pressed`, `aria-expanded`, `role="dialog"` / `"alert"` |
| ✅ | Keyboard nav for command palette (↑↓ / Enter / Esc) |
| ✅ | Touch targets ≥ 32 px on mobile chrome |

---

## Keyboard shortcuts

### Global

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + N` | New note |
| `Cmd/Ctrl + K` | Open drawer + focus search |
| `Cmd/Ctrl + P` | Command palette |
| `Cmd/Ctrl + G` | Open 3D graph view |
| `Esc` | Close mobile drawer / palette / sheets |

### Editor (CodeMirror)

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl + B` | Bold (toggle wrap) |
| `Cmd/Ctrl + I` | Italic (toggle wrap) |
| `Cmd/Ctrl + Shift + X` | Strikethrough |
| `Cmd/Ctrl + Shift + H` | Highlight |
| `Cmd/Ctrl + \`` | Inline code |
| `Cmd/Ctrl + 1` … `6` | Set heading level on the line |
| `Cmd/Ctrl + 0` | Remove heading |

---

## AI integration

Plume ships with a versioned, derived JSON format aimed at agents that want
to reason over a vault without re-parsing markdown.

```jsonc
{
  "format": "plume.ai-export.v1",
  "exportedAt": "2026-05-06T03:00:00.000Z",
  "stats": {
    "notes": 42,
    "approxTokensTotal": 18342,
    "wikilinks": 87
  },
  "notes": [
    {
      "id": "…",
      "title": "Project ideas",
      "folder": "Work",
      "tags": ["idea"],
      "content": "# …",
      "snippet": "First 280 plain-text characters …",
      "approxTokens": 84,
      "outbound": ["Roadmap"],
      "inbound": ["Sprint 1", "Sprint 2"]
    }
  ],
  "graph": {
    "nodes": [{ "id": "…", "title": "…" }],
    "edges": [{ "from": "…", "to": "…" }]
  }
}
```

Why this is a real win:

- **Snippets** let an agent build a top-down map of the vault without
  ingesting full content.
- **Pre-resolved inbound + outbound** wikilinks mean an agent can walk the
  graph by id without re-parsing every note.
- **`approxTokens` + `approxTokensTotal`** lets a context-budget plan happen
  cheaply before any expensive ingestion.
- **`stats` at the top** so a small probe call can decide whether to fetch
  the rest at all.

The format is locked as v1; additions are non-breaking, removals bump v2.
Full schema in [`PLUME_AI_FORMAT.md`](./PLUME_AI_FORMAT.md).

> **Suggested prompt fragment:** "The user has attached a
> `plume.ai-export.v1` JSON file. Use `notes[].snippet` for fast browsing,
> `graph.edges` to find related notes by id, and `stats.approxTokensTotal`
> to decide whether the whole vault fits in your context."

---

## Quick start

```bash
git clone https://github.com/BEKO2210/clawy-notes.git
cd clawy-notes
npm install
npm run dev          # http://localhost:5173
```

| Script | Purpose |
|---|---|
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check + production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint over the project |
| `npm test` | Run the 72-test Vitest suite (`run`) |
| `npm run test:watch` | Vitest in watch mode |

The dev URL also accepts `?audit=1`, which renders a comprehensive markdown
benchmark and flips a 30-check pass/fail matrix — handy for catching
extension regressions.

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v3 + a few CSS variables |
| State | Zustand with `persist` |
| Storage | IndexedDB (Dexie) primary, localStorage mirror |
| Editor | CodeMirror 6 (`lang-markdown`, line wrapping, custom keymap) |
| Markdown | Marked + DOMPurify |
| Math | KaTeX (lazy-loaded) |
| Diagrams | Mermaid (lazy-loaded, per diagram-type chunks) |
| Graph view | react-three-fiber + d3-force-3d (lazy-loaded) |
| PWA | vite-plugin-pwa (autoUpdate, workbox runtime caching) |
| Tests | Vitest (happy-dom + jsdom for XSS hardening) |
| Hosting | GitHub Pages (Actions) + Vercel — see `vite.config.ts` |

Initial bundle stays around **89 kB gzipped**. Heavy features (CodeMirror,
KaTeX, Mermaid, the 3D graph) are split into their own chunks and only fetched
when the user opens them.

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design.

---

## Privacy

Plume never sends a request anywhere on its own.

- All notes live in **your** browser's IndexedDB (`plume.kv`) and are
  mirrored best-effort to localStorage for fast reload.
- The only outbound traffic is the initial download of the app shell (and,
  the first time you use math or diagrams, the lazy chunks).
- No analytics, no ping-home, no account.
- Your data leaves the device only when **you** export it, or **you** install
  it as a PWA.

The fine print is in [`LICENSE`](./LICENSE).

---

## Roadmap

| Status | Item |
|---|---|
| ✅ | All current features above |
| 🔜 | Tabs system — multiple notes open at once |
| 🔜 | Vim mode (`@replit/codemirror-vim` drop-in) |
| 🔜 | Hierarchical folders (parent / child) |
| 🔜 | Swipe gestures on note list |
| 💭 | Optional encrypted sync (CRDT or Yjs) |
| 💭 | Per-note Markdown export (`.md` zip) |
| 💭 | Plugin host |

`💭` = idea on the wall. Open an issue if you want to push one up.

---

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — design, data flow, file layout
- [`STATUS.md`](./STATUS.md) — what's shipped, what's pending
- [`TEAM.md`](./TEAM.md) — team directory and squad assignments
- [`PLUME_AI_FORMAT.md`](./PLUME_AI_FORMAT.md) — agent-export schema (v1)
- [`LICENSE`](./LICENSE) — Plume End-User License (free for any use,
  source-available, no resale)

---

## Credits

- Editor by [CodeMirror 6](https://codemirror.net/)
- Markdown rendering by [Marked](https://marked.js.org/) + [DOMPurify](https://github.com/cure53/DOMPurify)
- Diagrams by [Mermaid](https://mermaid.js.org/)
- Math by [KaTeX](https://katex.org/)
- Graph layout by [d3-force-3d](https://github.com/vasturiano/d3-force-3d)
- 3D rendering by [react-three-fiber](https://r3f.docs.pmnd.rs/) + [drei](https://github.com/pmndrs/drei)
- Icons by [Lucide](https://lucide.dev/)
- Typeface inspiration: Space Grotesk + Plus Jakarta Sans + JetBrains Mono

Built with [Claude Code](https://claude.ai/code).
