# Plume

A fast, beautiful, offline-first markdown note editor.

**Live demo:** https://beko2210.github.io/clawy-notes/

## Features

- Markdown editor with split / editor / preview modes
- Live preview powered by Marked + DOMPurify
- Folders, tags, pinning, archiving
- Full-text search across notes
- Light and dark mode
- Local-first storage (Zustand `persist` to `localStorage`)
- Editorial typography (Space Grotesk + Plus Jakarta Sans + JetBrains Mono)
- Editor toolbar (bold, italic, headings, lists, checkboxes)

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React 19 + TypeScript |
| Build | Vite |
| Styling | Tailwind CSS v3 |
| State | Zustand (with `persist`) |
| Markdown | Marked + DOMPurify |
| Editor | CodeMirror 6 (lang-markdown) |
| Icons | Lucide React |
| Deploy | GitHub Pages (Actions) |

## Getting Started

```bash
npm install
npm run dev
```

The dev server runs at http://localhost:5173.

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and produce a production build in `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint over the project |

## Deployment

Pushes to `master` trigger `.github/workflows/deploy.yml`, which builds the
project and publishes `dist/` to the `gh-pages` branch via
`peaceiris/actions-gh-pages`.

The Vite `base` is set to `/clawy-notes/` to match the GitHub Pages path.

## Project Layout

```
src/
├── App.tsx       # Sidebar, editor, preview, top-level layout
├── store.ts      # Zustand store: notes, folders, tags, UI state
├── lib.ts        # Markdown rendering, title extraction, date formatting
├── types.ts      # Note, Folder, Tag types
├── index.css     # Tailwind layers + design tokens
└── main.tsx      # React entry point
```

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for the full design and data model.

## Documentation

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) - tech stack, data models, stage plan
- [`STATUS.md`](./STATUS.md) - current progress and next steps
- [`TEAM.md`](./TEAM.md) - team directory and squad assignments

## License

Plume is provided under the [Plume End-User License](./LICENSE) — free
for any use (personal, commercial, non-profit, educational,
governmental). The source is available, but redistribution and resale
of the application as a whole are restricted. See `LICENSE` for the
full terms.
