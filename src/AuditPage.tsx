import { useEffect, useMemo, useState } from 'react'
import { renderMarkdown } from './lib'

const AUDIT_NOTE = `---
title: Test Note
tags: [test, audit]
date: 2026-05-06
---

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

**Bold text** and *italic text* and ~~strikethrough~~.
Inline \`code\` and ==highlight== and H^2^O and CO~2~.

- Bullet 1
- Bullet 2
  - Nested bullet

1. Numbered 1
2. Numbered 2

- [ ] Unchecked task
- [x] Checked task

> Blockquote
>
> Second paragraph in quote

| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |
| Cell 3   |          |

\`\`\`javascript
function test() {
  return true
}
\`\`\`

[External Link](https://example.com)

[[Existing Note]] and [[Ghost Note That Does Not Exist]]

> [!info]
> An informational callout.

> [!warning]+ Watch out
> This one starts open.

> [!tip]- Click to open
> Collapsed by default.

Inline math $E = mc^2$ and block math:

$$
\\sum_{i=1}^{n} x_i
$$

\`\`\`mermaid
graph TD
  A-->B
  A-->C
\`\`\`

---

End.
`

interface Check {
  id: string
  label: string
  predicate: (html: string) => boolean
}

const CHECKS: Check[] = [
  { id: 'h1', label: 'Renders <h1>', predicate: (h) => /<h1[^>]*>.*Heading 1/.test(h) },
  { id: 'h2', label: 'Renders <h2>', predicate: (h) => /<h2[^>]*>.*Heading 2/.test(h) },
  { id: 'h3', label: 'Renders <h3>', predicate: (h) => /<h3[^>]*>.*Heading 3/.test(h) },
  { id: 'h4', label: 'Renders <h4>', predicate: (h) => /<h4[^>]*>.*Heading 4/.test(h) },
  { id: 'h5', label: 'Renders <h5>', predicate: (h) => /<h5[^>]*>.*Heading 5/.test(h) },
  { id: 'h6', label: 'Renders <h6>', predicate: (h) => /<h6[^>]*>.*Heading 6/.test(h) },
  { id: 'bold', label: 'Renders <strong> for **bold**', predicate: (h) => /<strong>Bold text<\/strong>/.test(h) },
  { id: 'italic', label: 'Renders <em> for *italic*', predicate: (h) => /<em>italic text<\/em>/.test(h) },
  { id: 'strike', label: 'Renders <del>/<s> for ~~strike~~', predicate: (h) => /<(del|s)>strikethrough<\/(del|s)>/.test(h) },
  { id: 'code', label: 'Renders <code> for `inline`', predicate: (h) => /<code>code<\/code>/.test(h) },
  { id: 'highlight', label: 'Renders <mark> for ==highlight==', predicate: (h) => /<mark[^>]*>highlight<\/mark>/.test(h) },
  { id: 'sup', label: 'Renders <sup> for ^2^', predicate: (h) => /<sup>2<\/sup>/.test(h) },
  { id: 'sub', label: 'Renders <sub> for ~2~', predicate: (h) => /<sub>2<\/sub>/.test(h) },
  { id: 'ul', label: 'Renders bulleted list', predicate: (h) => /<ul>[\s\S]*?<li>/.test(h) },
  { id: 'ol', label: 'Renders numbered list', predicate: (h) => /<ol>[\s\S]*?<li>/.test(h) },
  { id: 'task-unchecked', label: 'Renders unchecked task', predicate: (h) => /<input[^>]*data-task-idx[^>]*>(?![^]*checked)/.test(h) || /<input[^>]*type="checkbox"[^>]*>(?!.*checked)/.test(h) },
  { id: 'task-checked', label: 'Renders checked task', predicate: (h) => /<input[^>]*checked[^>]*>/.test(h) },
  { id: 'blockquote', label: 'Renders <blockquote>', predicate: (h) => /<blockquote>/.test(h) },
  { id: 'table', label: 'Renders <table> with <th> and <td>', predicate: (h) => /<table>[\s\S]*<th>[\s\S]*<td>/.test(h) },
  { id: 'codeblock', label: 'Renders fenced code block with language label', predicate: (h) => /<div class="plume-codeblock"[^>]*data-lang="javascript"/.test(h) },
  { id: 'codeblock-copy', label: 'Code block has Copy button', predicate: (h) => /<button[^>]*class="plume-copy"[^>]*>Copy<\/button>/.test(h) },
  { id: 'link', label: 'Renders external link', predicate: (h) => /<a[^>]*href="https:\/\/example\.com"/.test(h) },
  { id: 'wikilink', label: 'Renders wikilink with data-wikilink', predicate: (h) => /<a[^>]*data-wikilink="Existing Note"/.test(h) },
  { id: 'wikilink-ghost', label: 'Ghost wikilink gets ghost class', predicate: (h) => /class="plume-wikilink plume-wikilink-ghost"[^>]*data-wikilink="Ghost Note That Does Not Exist"/.test(h) },
  { id: 'frontmatter', label: 'Renders YAML frontmatter as Properties block', predicate: (h) => /<div class="plume-frontmatter"/.test(h) },
  { id: 'frontmatter-row', label: 'Frontmatter row contains key/value', predicate: (h) => /<span class="plume-fm-key">title<\/span>[\s\S]*<span class="plume-fm-value">Test Note<\/span>/.test(h) },
  { id: 'hr', label: 'Renders <hr>', predicate: (h) => /<hr\s*\/?>/.test(h) },
  { id: 'no-script', label: 'Sanitizer strips <script>', predicate: (h) => !/<script/.test(h) },
  { id: 'callout-info', label: 'Renders > [!info] callout', predicate: (h) => /plume-callout plume-callout-info/.test(h) },
  { id: 'callout-warning-open', label: 'Collapsible callout with + opens by default', predicate: (h) => /<details[^>]+plume-callout-warning[^>]+open/.test(h) },
  { id: 'callout-tip-collapsed', label: 'Collapsible callout with - is closed by default', predicate: (h) => /<details(?![^>]+open)[^>]+plume-callout-tip/.test(h) },
  { id: 'math-inline', label: 'Inline math $...$ gets katex placeholder', predicate: (h) => /class="plume-katex-inline"[^>]*data-katex="inline"/.test(h) },
  { id: 'math-block', label: 'Block math $$...$$ gets katex placeholder', predicate: (h) => /class="plume-katex-block"[^>]*data-katex="block"/.test(h) },
  { id: 'mermaid', label: '```mermaid block routes to mermaid placeholder', predicate: (h) => /class="plume-mermaid"[^>]*data-mermaid/.test(h) },
]

export function AuditPage({ onClose }: { onClose: () => void }) {
  const html = useMemo(
    () => renderMarkdown(AUDIT_NOTE, { existingTitles: new Set(['Existing Note']) }),
    [],
  )
  const results = useMemo(() => CHECKS.map((c) => ({ ...c, pass: c.predicate(html) })), [html])
  const passCount = results.filter((r) => r.pass).length

  // Collapse / expand the rendered HTML on click for inspection
  const [showHtml, setShowHtml] = useState(false)

  // Lock scroll
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[80] bg-[var(--bg-primary)] overflow-y-auto">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--bg-tertiary)] bg-[var(--bg-secondary)]">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="text-base font-display font-bold tracking-tight">Markdown audit</h1>
          <span
            className={`text-xs font-mono px-2 py-0.5 rounded ${
              passCount === results.length
                ? 'bg-green-500/15 text-green-600'
                : 'bg-amber-500/15 text-amber-600'
            }`}
          >
            {passCount} / {results.length} passed
          </span>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded-md border border-[var(--bg-tertiary)] text-sm hover:bg-[var(--bg-tertiary)]"
        >
          Close
        </button>
      </header>

      <div className="grid lg:grid-cols-2 gap-4 p-4 max-w-[1280px] mx-auto">
        <section className="rounded-xl border border-[var(--bg-tertiary)] bg-[var(--bg-secondary)] p-4">
          <h2 className="text-sm font-semibold mb-3">Checks</h2>
          <ul className="space-y-1.5 text-sm">
            {results.map((r) => (
              <li key={r.id} className="flex items-start gap-2">
                <span
                  className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold flex-shrink-0 ${
                    r.pass ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'
                  }`}
                >
                  {r.pass ? '✓' : '✗'}
                </span>
                <span className="flex-1">
                  <span className="text-[var(--text-primary)]">{r.label}</span>
                  <span className="ml-2 text-[10px] font-mono text-[var(--text-tertiary)]">
                    {r.id}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <button
            onClick={() => setShowHtml((v) => !v)}
            className="mt-4 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] underline-offset-2 hover:underline"
          >
            {showHtml ? 'Hide' : 'Show'} raw HTML
          </button>
          {showHtml && (
            <pre className="mt-2 text-[10px] p-2 rounded bg-[var(--bg-primary)] border border-[var(--bg-tertiary)] overflow-x-auto whitespace-pre-wrap">
              {html}
            </pre>
          )}
        </section>

        <section className="rounded-xl border border-[var(--bg-tertiary)] bg-[var(--bg-primary)] p-4">
          <h2 className="text-sm font-semibold mb-3">Live preview</h2>
          <div
            className="prose prose-sm max-w-none dark:prose-invert"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </section>
      </div>
    </div>
  )
}
