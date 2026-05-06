import { describe, it, expect } from 'vitest'
import { extractTitle, extractOutline, formatDate, renderMarkdown, toggleTaskInContent } from './lib'

describe('extractTitle', () => {
  it('uses the first heading as the title', () => {
    expect(extractTitle('# Hello world\n\nbody')).toBe('Hello world')
  })

  it('falls back to the first non-empty line if there is no heading', () => {
    expect(extractTitle('\n\nThis is a body line\nMore body')).toBe('This is a body line')
  })

  it('trims a long fallback line to 50 chars', () => {
    const long = 'a'.repeat(120)
    expect(extractTitle(long)).toHaveLength(50)
  })

  it('returns "Untitled Note" for empty input', () => {
    expect(extractTitle('')).toBe('Untitled Note')
    expect(extractTitle('   \n\n  ')).toBe('Untitled Note')
  })

  it('handles any heading level', () => {
    expect(extractTitle('### Sub heading\nbody')).toBe('Sub heading')
  })

  it('strips inline markdown so titles render as plain text', () => {
    expect(extractTitle('**belkis**')).toBe('belkis')
    expect(extractTitle('*italic* and **bold**')).toBe('italic and bold')
    expect(extractTitle('~~strike~~ thing')).toBe('strike thing')
    expect(extractTitle('a `code` snippet')).toBe('a code snippet')
    expect(extractTitle('# Hello **world**')).toBe('Hello world')
    expect(extractTitle('See [Plume](https://example.com)')).toBe('See Plume')
  })

  it('strips list markers from the title display', () => {
    expect(extractTitle('- [ ] Belkis Aslani')).toBe('Belkis Aslani')
    expect(extractTitle('- [x] done thing')).toBe('done thing')
    expect(extractTitle('- bullet item')).toBe('bullet item')
    expect(extractTitle('* another bullet')).toBe('another bullet')
    expect(extractTitle('1. numbered')).toBe('numbered')
    expect(extractTitle('> quoted')).toBe('quoted')
  })
})

describe('formatDate', () => {
  it('returns "Just now" for very recent timestamps', () => {
    const now = new Date().toISOString()
    expect(formatDate(now)).toMatch(/Just now|m ago/)
  })

  it('returns minutes for sub-hour deltas', () => {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    expect(formatDate(fiveMinutesAgo)).toBe('5m ago')
  })

  it('returns hours for sub-day deltas', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
    expect(formatDate(twoHoursAgo)).toBe('2h ago')
  })

  it('returns days for sub-week deltas', () => {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
    expect(formatDate(threeDaysAgo)).toBe('3d ago')
  })
})

describe('renderMarkdown', () => {
  it('renders inline formatting', () => {
    const html = renderMarkdown('**bold** and *italic*')
    expect(html).toContain('<strong>bold</strong>')
    expect(html).toContain('<em>italic</em>')
  })

  it('renders headings', () => {
    expect(renderMarkdown('# Title')).toContain('<h1')
  })

  it('renders GFM tables', () => {
    const md = '| a | b |\n| --- | --- |\n| 1 | 2 |'
    const html = renderMarkdown(md)
    expect(html).toContain('<table')
    expect(html).toContain('<th')
  })

  it('renders fenced code blocks', () => {
    const html = renderMarkdown('```\nconst x = 1\n```')
    expect(html).toContain('<pre>')
    expect(html).toContain('<code')
  })

  it('strips dangerous script tags', () => {
    const html = renderMarkdown('hello <script>alert(1)</script> world')
    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(1)')
  })

  it('strips event handlers from sanitized HTML', () => {
    const html = renderMarkdown('<a href="x" onclick="evil()">link</a>')
    expect(html).not.toContain('onclick')
  })

  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('')
  })

  it('renders highlight ==text== as <mark>', () => {
    const html = renderMarkdown('foo ==hi== bar')
    expect(html).toContain('<mark class="plume-highlight">hi</mark>')
  })

  it('renders ^text^ as <sup>', () => {
    const html = renderMarkdown('H^2^O')
    expect(html).toContain('<sup>2</sup>')
  })

  it('renders ~text~ as <sub> without breaking ~~strike~~', () => {
    const sub = renderMarkdown('CO~2~')
    expect(sub).toContain('<sub>2</sub>')
    const strike = renderMarkdown('~~strike~~')
    expect(strike).toMatch(/<(del|s)>strike<\/(del|s)>/)
    expect(strike).not.toContain('<sub>')
  })

  it('renders [[wikilink]] as anchor with data-wikilink', () => {
    const html = renderMarkdown('See [[Hello World]]', {
      existingTitles: new Set(['Hello World']),
    })
    expect(html).toMatch(/<a[^>]*data-wikilink="Hello World"/)
    expect(html).toContain('class="plume-wikilink"')
  })

  it('marks unmatched [[wikilink]] as ghost', () => {
    const html = renderMarkdown('See [[Unknown]]')
    expect(html).toContain('plume-wikilink-ghost')
  })

  it('renders YAML frontmatter as a properties block', () => {
    const html = renderMarkdown('---\ntitle: Hello\ntags: a, b\n---\n\n# Body')
    expect(html).toContain('plume-frontmatter')
    expect(html).toContain('Properties')
    expect(html).toContain('<span class="plume-fm-key">title</span>')
    expect(html).toContain('<span class="plume-fm-value">Hello</span>')
  })

  it('wraps fenced code blocks with copy button + language label', () => {
    const html = renderMarkdown('```js\nconst x = 1\n```')
    expect(html).toContain('class="plume-codeblock"')
    expect(html).toContain('data-lang="js"')
    expect(html).toMatch(/class="plume-copy"[^>]*>Copy<\/button>/)
  })

  it('renders > [!info] callout', () => {
    const html = renderMarkdown('> [!info]\n> Heads up!')
    expect(html).toContain('plume-callout plume-callout-info')
    expect(html).toContain('Heads up!')
  })

  it('renders collapsible callout with custom title', () => {
    const html = renderMarkdown('> [!warning]- Be careful\n> Hidden by default')
    expect(html).toContain('<details')
    expect(html).toContain('plume-callout-warning')
    expect(html).toContain('Be careful')
    // No `open` attribute when marker is `-`
    expect(html).not.toMatch(/<details[^>]+open/)
  })

  it('does not render unknown callout variants', () => {
    const html = renderMarkdown('> [!unknownvariant]\n> body')
    expect(html).not.toContain('plume-callout')
    // Falls through to a regular blockquote
    expect(html).toContain('<blockquote>')
  })

  it('assigns sequential data-task-idx to task checkboxes', () => {
    const html = renderMarkdown('- [ ] one\n- [x] two\n- [ ] three')
    expect(html).toContain('data-task-idx="0"')
    expect(html).toContain('data-task-idx="1"')
    expect(html).toContain('data-task-idx="2"')
  })
})

describe('extractOutline', () => {
  it('returns headings up to the maxLevel', () => {
    const md = '# H1\n\nbody\n## H2\n### H3\n#### H4\nrest'
    const outline = extractOutline(md, 3)
    expect(outline.map((o) => [o.level, o.text])).toEqual([
      [1, 'H1'],
      [2, 'H2'],
      [3, 'H3'],
    ])
  })

  it('strips inline markdown from heading text', () => {
    const outline = extractOutline('# **Hello** *world*')
    expect(outline[0].text).toBe('Hello world')
  })

  it('ignores hash-like lines inside fenced code', () => {
    const md = '# Title\n\n```\n# This is not a heading\n```\n\n## Real heading'
    const outline = extractOutline(md)
    expect(outline.map((o) => o.text)).toEqual(['Title', 'Real heading'])
  })

  it('returns empty for content without headings', () => {
    expect(extractOutline('Just text.\n\nAnother line.')).toEqual([])
  })
})

describe('toggleTaskInContent', () => {
  it('toggles the n-th task between [ ] and [x]', () => {
    const src = '- [ ] one\n- [x] two\n- [ ] three'
    expect(toggleTaskInContent(src, 0)).toBe('- [x] one\n- [x] two\n- [ ] three')
    expect(toggleTaskInContent(src, 1)).toBe('- [ ] one\n- [ ] two\n- [ ] three')
    expect(toggleTaskInContent(src, 2)).toBe('- [ ] one\n- [x] two\n- [x] three')
  })

  it('leaves the source unchanged when index is out of range', () => {
    const src = '- [ ] only'
    expect(toggleTaskInContent(src, 5)).toBe(src)
  })
})
