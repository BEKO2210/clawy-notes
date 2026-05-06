---
title: Plume benchmark
tags: [test, audit, benchmark]
date: 2026-05-06
---

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6

## Inline formatting

**Bold**, *italic*, ~~strikethrough~~, `inline code`, ==highlight==,
super^2^ and sub~3~ ions, [external](https://example.com),
[[Existing Note]] and [[Ghost Note]].

Mixed: ***bold italic***, `**bold inside code**` should stay literal,
escaped \*not italic\*.

## Lists

- Bulleted one
- Bulleted two
  - Nested
    - Deeper
- Bulleted three

1. First
2. Second
   1. Nested numbered
   2. Another
3. Third

- [ ] Open task
- [x] Completed task
- [ ] Another open task

## Blockquotes

> Single quote line
> with continuation

> Nested:
> > Inner level
> > > Third level

## Tables

| Left | Centre | Right |
| :--- | :----: | ----: |
| a    | b      | c     |
| 1    | 2      | 3     |
| 🎉   | 中文   | عربية |

## Code blocks

```javascript
function hello(name) {
  return `Hello, ${name}!`
}
```

```python
def fib(n):
    return n if n < 2 else fib(n - 1) + fib(n - 2)
```

```
Plain code without a language.
Multiple lines.
```

## Callouts

> [!info]
> Plain info callout.

> [!warning]+ Warning that opens by default
> Body content with **bold** and a list:
> - one
> - two

> [!tip]- Collapsed by default
> Hidden until clicked.

> [!danger]
> Danger callout with `inline code`.

> [!success]
> All good.

> [!quote]
> "Be regular and orderly in your life…" — Flaubert

## Math-ish (not yet supported, should not crash)

E = mc^2 with a regular paragraph.

## Embeds + images

![alt text](https://example.com/img.png)

External link: <https://example.com>

## Horizontal rule

---

## XSS attempts (must be sanitized)

<script>alert('xss-1')</script>

<a href="javascript:alert('xss-2')">click me</a>

<img src="x" onerror="alert('xss-3')">

<a href="https://example.com" onclick="alert('xss-4')">link</a>

<iframe src="https://evil.example"></iframe>

<style>body { display: none }</style>

<svg><script>alert('xss-5')</script></svg>

## Long paragraph for performance

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod
tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim
veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex
ea commodo consequat. Duis aute irure dolor in reprehenderit in
voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur
sint occaecat cupidatat non proident, sunt in culpa qui officia
deserunt mollit anim id est laborum.

## Edge cases

- A line with **only** a single asterisk: *
- A line with `code containing | a pipe` inside a paragraph
- A `<` and `>` in prose
- A standalone tilde ~ should not become a sub
- An equals sign = should not become a highlight
- A backtick ` should not start an unmatched code span

End of benchmark.
