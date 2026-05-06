// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import plumeBenchmark from './__fixtures__/plume-benchmark.md?raw'
import externalBenchmark from './__fixtures__/markdown-test-file.md?raw'
import { renderMarkdown } from './lib'

const existingTitles = new Set(['Existing Note'])

// Sanity helper — rough element counts, not strict equality.
function countMatches(html: string, re: RegExp): number {
  return (html.match(re) ?? []).length
}

describe('renderMarkdown — Plume benchmark fixture', () => {
  const html = renderMarkdown(plumeBenchmark, { existingTitles })

  it('renders without throwing', () => {
    expect(typeof html).toBe('string')
    expect(html.length).toBeGreaterThan(1000)
  })

  it('contains all six heading levels', () => {
    for (let n = 1; n <= 6; n++) {
      expect(html).toMatch(new RegExp(`<h${n}[^>]*>`))
    }
  })

  it('renders every Plume inline extension', () => {
    expect(html).toContain('<mark class="plume-highlight">highlight</mark>')
    expect(html).toContain('<sup>2</sup>')
    expect(html).toContain('<sub>3</sub>')
    expect(html).toContain('<strong>Bold</strong>')
    expect(html).toContain('<em>italic</em>')
    expect(html).toMatch(/<(del|s)>strikethrough<\/(del|s)>/)
    expect(html).toContain('<code>inline code</code>')
  })

  it('renders wikilinks with the right ghost / existing class', () => {
    expect(html).toMatch(/class="plume-wikilink"[^>]*data-wikilink="Existing Note"/)
    expect(html).toContain('plume-wikilink-ghost')
  })

  it('renders the YAML frontmatter as a Properties block', () => {
    expect(html).toContain('plume-frontmatter')
    expect(html).toContain('title')
    expect(html).toContain('Plume benchmark')
  })

  it('renders all callout variants used in the fixture', () => {
    for (const v of ['info', 'warning', 'tip', 'danger', 'success', 'quote']) {
      expect(html).toContain(`plume-callout-${v}`)
    }
    // Open and closed collapsibles
    expect(html).toMatch(/<details[^>]+plume-callout-warning[^>]+open/)
    expect(html).toMatch(/<details(?![^>]+open)[^>]+plume-callout-tip/)
  })

  it('renders fenced code blocks with language label and copy button', () => {
    expect(html).toContain('plume-codeblock')
    expect(html).toContain('data-lang="javascript"')
    expect(html).toContain('data-lang="python"')
    expect(countMatches(html, /class="plume-copy"/g)).toBeGreaterThanOrEqual(3)
  })

  it('renders the GFM table with three rows', () => {
    expect(html).toMatch(/<table>[\s\S]*<th[^>]*>Left/)
    expect(countMatches(html, /<tr>/g)).toBe(4) // 1 header + 3 body rows
  })

  it('assigns a sequential data-task-idx to each task checkbox', () => {
    expect(html).toContain('data-task-idx="0"')
    expect(html).toContain('data-task-idx="1"')
    expect(html).toContain('data-task-idx="2"')
  })

  it('handles unicode + emoji + RTL correctly', () => {
    expect(html).toContain('🎉')
    expect(html).toContain('中文')
    expect(html).toContain('عربية')
  })

  describe('XSS sanitisation', () => {
    it('strips <script> tags entirely', () => {
      expect(html).not.toContain('<script')
      expect(html).not.toContain('alert(')
    })

    it('drops on* event handlers', () => {
      expect(html).not.toMatch(/on(error|click|load|focus|mouseover)\s*=/i)
    })

    it('blocks javascript: URLs', () => {
      expect(html).not.toMatch(/href\s*=\s*["']?javascript:/i)
    })

    it('strips <iframe> and <style>', () => {
      expect(html).not.toContain('<iframe')
      expect(html).not.toContain('<style')
    })
  })

  it('renders within a tight time budget', () => {
    const start = performance.now()
    const out = renderMarkdown(plumeBenchmark, { existingTitles })
    const elapsed = performance.now() - start
    expect(out.length).toBeGreaterThan(0)
    // Plume benchmark (~120 lines) should comfortably render under 50ms even
    // on slow CI runners. Bumps to 100ms as a hard ceiling so a regression
    // 2-3x slower will trip the test.
    expect(elapsed).toBeLessThan(100)
  })
})

describe('renderMarkdown — external markdown-test-file (Daring Fireball syntax doc)', () => {
  it('renders the full reference document without throwing or producing XSS', () => {
    const html = renderMarkdown(externalBenchmark)
    expect(html.length).toBeGreaterThan(5000)
    // Should produce at least 4 headings (Overview, Philosophy, Inline HTML, …)
    expect(countMatches(html, /<h[1-6][^>]*>/g)).toBeGreaterThan(10)
    // Many code blocks in this reference doc
    expect(countMatches(html, /<pre>/g)).toBeGreaterThan(5)
    // No script or event handlers smuggle through
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/on(error|click|load|focus|mouseover)\s*=/i)
    expect(html).not.toMatch(/href\s*=\s*["']?javascript:/i)
  })

  it('renders the full reference doc within budget', () => {
    const start = performance.now()
    const html = renderMarkdown(externalBenchmark)
    const elapsed = performance.now() - start
    expect(html.length).toBeGreaterThan(0)
    // ~6.5 KB document of dense markdown — under 200ms is the budget.
    expect(elapsed).toBeLessThan(200)
  })
})
