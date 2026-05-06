import { marked, type MarkedExtension, type Tokens } from 'marked'
import DOMPurify from 'dompurify'

// ─── Custom token types ──────────────────────────────────────────────────────

interface HighlightToken extends Tokens.Generic {
  type: 'highlight'
  raw: string
  text: string
}

interface SuperscriptToken extends Tokens.Generic {
  type: 'superscript'
  raw: string
  text: string
}

interface SubscriptToken extends Tokens.Generic {
  type: 'subscript'
  raw: string
  text: string
}

interface WikilinkToken extends Tokens.Generic {
  type: 'wikilink'
  raw: string
  title: string
}

interface FrontmatterToken extends Tokens.Generic {
  type: 'frontmatter'
  raw: string
  yaml: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// Resolves at render time whether a wikilink target is an existing note.
let existingTitlesLower: Set<string> = new Set()
// Sequential index assigned to each task checkbox in render order, so the
// preview can map a click back to the n-th occurrence in the source.
let taskCounter = 0

// ─── Inline extensions ───────────────────────────────────────────────────────

const highlight: MarkedExtension['extensions'] = [
  {
    name: 'highlight',
    level: 'inline',
    start(src: string) {
      return src.indexOf('==')
    },
    tokenizer(src: string): HighlightToken | undefined {
      const match = /^==([^=\n]+?)==/.exec(src)
      if (!match) return
      return { type: 'highlight', raw: match[0], text: match[1] }
    },
    renderer(token) {
      const t = token as HighlightToken
      return `<mark class="plume-highlight">${escapeHtml(t.text)}</mark>`
    },
  },
]

const superscript: MarkedExtension['extensions'] = [
  {
    name: 'superscript',
    level: 'inline',
    start(src: string) {
      const i = src.indexOf('^')
      return i === -1 ? -1 : i
    },
    tokenizer(src: string): SuperscriptToken | undefined {
      // Match ^...^ on a single line, no spaces or carets inside.
      const match = /^\^([^\s^]+?)\^/.exec(src)
      if (!match) return
      return { type: 'superscript', raw: match[0], text: match[1] }
    },
    renderer(token) {
      const t = token as SuperscriptToken
      return `<sup>${escapeHtml(t.text)}</sup>`
    },
  },
]

const subscript: MarkedExtension['extensions'] = [
  {
    name: 'subscript',
    level: 'inline',
    start(src: string) {
      // Avoid matching where ~~strike~~ would start.
      const i = src.indexOf('~')
      if (i === -1) return -1
      // If followed by another ~, it's strike; let GFM handle it.
      if (src[i + 1] === '~') return -1
      return i
    },
    tokenizer(src: string): SubscriptToken | undefined {
      // Single-tilde wrap, no spaces, not followed by another tilde
      const match = /^~([^\s~]+?)~(?!~)/.exec(src)
      if (!match) return
      return { type: 'subscript', raw: match[0], text: match[1] }
    },
    renderer(token) {
      const t = token as SubscriptToken
      return `<sub>${escapeHtml(t.text)}</sub>`
    },
  },
]

const wikilink: MarkedExtension['extensions'] = [
  {
    name: 'wikilink',
    level: 'inline',
    start(src: string) {
      return src.indexOf('[[')
    },
    tokenizer(src: string): WikilinkToken | undefined {
      const match = /^\[\[([^\]]+?)\]\]/.exec(src)
      if (!match) return
      return { type: 'wikilink', raw: match[0], title: match[1].trim() }
    },
    renderer(token) {
      const t = token as WikilinkToken
      const exists = existingTitlesLower.has(t.title.toLowerCase())
      const cls = exists
        ? 'plume-wikilink'
        : 'plume-wikilink plume-wikilink-ghost'
      return `<a href="#" class="${cls}" data-wikilink="${escapeHtml(t.title)}">${escapeHtml(t.title)}</a>`
    },
  },
]

// ─── Block extensions ────────────────────────────────────────────────────────

const frontmatter: MarkedExtension['extensions'] = [
  {
    name: 'frontmatter',
    level: 'block',
    start(src: string) {
      return src.startsWith('---\n') ? 0 : -1
    },
    tokenizer(src: string): FrontmatterToken | undefined {
      // Only at the very start of the document.
      const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(src)
      if (!match) return
      return { type: 'frontmatter', raw: match[0], yaml: match[1] }
    },
    renderer(token) {
      const t = token as FrontmatterToken
      const rows = t.yaml
        .split('\n')
        .filter((l) => l.trim().length > 0)
        .map((line) => {
          const idx = line.indexOf(':')
          if (idx === -1) {
            return `<div class="plume-fm-row"><span class="plume-fm-key">${escapeHtml(line)}</span></div>`
          }
          const key = line.slice(0, idx).trim()
          const value = line.slice(idx + 1).trim()
          return `<div class="plume-fm-row"><span class="plume-fm-key">${escapeHtml(key)}</span><span class="plume-fm-value">${escapeHtml(value)}</span></div>`
        })
        .join('')
      return `<div class="plume-frontmatter" role="region" aria-label="Note properties"><div class="plume-fm-title">Properties</div>${rows}</div>`
    },
  },
]

// ─── Renderer overrides ──────────────────────────────────────────────────────

const renderer = {
  // Wrap fenced code blocks with a copy button + language label.
  code(this: void, { text, lang }: Tokens.Code): string {
    const language = lang?.trim() || 'text'
    return `<div class="plume-codeblock" data-lang="${escapeHtml(language)}"><div class="plume-codeblock-head"><span class="plume-codeblock-lang">${escapeHtml(language)}</span><button class="plume-copy" data-copy="${encodeURIComponent(text)}" type="button" aria-label="Copy code">Copy</button></div><pre><code class="language-${escapeHtml(language)}">${escapeHtml(text)}</code></pre></div>`
  },

  // Add a sequential index to each task checkbox so the preview pane can
  // toggle the matching occurrence in the source on click.
  checkbox(this: void, { checked }: Tokens.Checkbox): string {
    const idx = taskCounter++
    return `<input type="checkbox" data-task-idx="${idx}" class="plume-task-checkbox"${checked ? ' checked' : ''}>`
  },
}

// Configure marked once with extensions + renderer overrides.
marked.use({
  gfm: true,
  breaks: true,
  extensions: [
    ...(highlight ?? []),
    ...(superscript ?? []),
    ...(subscript ?? []),
    ...(wikilink ?? []),
    ...(frontmatter ?? []),
  ],
  renderer,
})

// ─── Public API ──────────────────────────────────────────────────────────────

export interface RenderOptions {
  existingTitles?: Set<string>
}

export function renderMarkdown(content: string, options: RenderOptions = {}): string {
  if (!content) return ''
  // Snapshot per-render state used by extensions / renderer overrides.
  existingTitlesLower = new Set(
    [...(options.existingTitles ?? [])].map((t) => t.toLowerCase()),
  )
  taskCounter = 0
  const rawHtml = marked.parse(content) as string
  return DOMPurify.sanitize(rawHtml, {
    ADD_ATTR: ['data-task-idx', 'data-wikilink', 'data-copy', 'data-lang'],
  })
}

// Toggle the n-th task checkbox in source. Returns updated content.
export function toggleTaskInContent(content: string, index: number): string {
  const re = /^(\s*[-*+]\s*\[)([ xX])(\])/gm
  let count = 0
  return content.replace(re, (full, prefix, mark, suffix) => {
    if (count++ !== index) return full
    const next = mark === ' ' ? 'x' : ' '
    return `${prefix}${next}${suffix}`
  })
}

// ─── Title + date helpers (unchanged behaviour) ──────────────────────────────

function stripMarkdown(s: string): string {
  return s
    .replace(/^#+\s+/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .replace(/==([^=]+)==/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function extractTitle(content: string): string {
  // Skip a YAML frontmatter block when extracting the title.
  let body = content
  const fm = /^---\n[\s\S]*?\n---\n?/.exec(content)
  if (fm) body = content.slice(fm[0].length)

  const lines = body.split('\n')
  for (const line of lines) {
    const match = line.match(/^#+\s+(.+)$/)
    if (match) return stripMarkdown(match[1])
  }
  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed) return stripMarkdown(trimmed).slice(0, 50)
  }
  return 'Untitled Note'
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    if (hours < 1) {
      const minutes = Math.floor(diff / 60000)
      return minutes < 1 ? 'Just now' : `${minutes}m ago`
    }
    return `${hours}h ago`
  }

  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return `${days}d ago`
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
