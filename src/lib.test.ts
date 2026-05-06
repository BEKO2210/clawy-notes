import { describe, it, expect } from 'vitest'
import { extractTitle, formatDate, renderMarkdown } from './lib'

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
})
