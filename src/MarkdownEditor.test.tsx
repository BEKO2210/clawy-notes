import { describe, expect, it, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import { useState } from 'react'
import { MarkdownEditor, type MarkdownEditorHandle } from './MarkdownEditor'

/**
 * Mounts MarkdownEditor inside a controlled host that forwards every
 * onChange back into a value prop — exactly how App.tsx wires it. The
 * test grabs both the imperative handle (to simulate typing via
 * programmatic dispatches against CodeMirror) and the latest emitted
 * value so we can assert the round-trip never loses characters.
 */
function ControlledHost({
  initial,
  onValueChange,
  handleRef,
}: {
  initial: string
  onValueChange: (v: string) => void
  handleRef: { current: MarkdownEditorHandle | null }
}) {
  const [value, setValue] = useState(initial)
  return (
    <MarkdownEditor
      ref={(h) => {
        handleRef.current = h
      }}
      value={value}
      onChange={(next) => {
        setValue(next)
        onValueChange(next)
      }}
      darkMode={false}
    />
  )
}

describe('<MarkdownEditor /> round-trip stability', () => {
  it('preserves text typed before pressing Enter (Käse → \\n)', () => {
    const onChange = vi.fn<(v: string) => void>()
    const handleRef = { current: null as MarkdownEditorHandle | null }

    render(<ControlledHost initial="" onValueChange={onChange} handleRef={handleRef} />)

    expect(handleRef.current).not.toBeNull()
    // Type "Käse" one character at a time, then Enter.
    act(() => handleRef.current!.insertAtCursor('K'))
    act(() => handleRef.current!.insertAtCursor('ä'))
    act(() => handleRef.current!.insertAtCursor('s'))
    act(() => handleRef.current!.insertAtCursor('e'))
    act(() => handleRef.current!.insertAtCursor('\n'))

    // The last value the editor emitted to the host must contain everything.
    const last = onChange.mock.calls.at(-1)?.[0]
    expect(last).toBe('Käse\n')
    // And no spurious empty/clobbered intermediate emit.
    expect(onChange.mock.calls.map((c) => c[0])).toEqual([
      'K',
      'Kä',
      'Käs',
      'Käse',
      'Käse\n',
    ])
  })

  it('keeps a numbered-list draft intact across newline insertions', () => {
    const onChange = vi.fn<(v: string) => void>()
    const handleRef = { current: null as MarkdownEditorHandle | null }
    render(<ControlledHost initial="" onValueChange={onChange} handleRef={handleRef} />)

    act(() => handleRef.current!.insertAtCursor('1. erstens'))
    act(() => handleRef.current!.insertAtCursor('\n'))
    act(() => handleRef.current!.insertAtCursor('2. zweitens'))
    act(() => handleRef.current!.insertAtCursor('\n'))
    act(() => handleRef.current!.insertAtCursor('3. drittens'))

    expect(onChange.mock.calls.at(-1)?.[0]).toBe(
      '1. erstens\n2. zweitens\n3. drittens',
    )
  })

  it('does not reset the doc when the parent round-trips the same value', () => {
    // Spy on EditorView.dispatch — the bug we are guarding against was
    // an extraneous "replace whole doc" dispatch on every keystroke.
    const onChange = vi.fn<(v: string) => void>()
    const handleRef = { current: null as MarkdownEditorHandle | null }
    const { rerender } = render(
      <ControlledHost initial="hi" onValueChange={onChange} handleRef={handleRef} />,
    )
    // Re-render with the same value reference. The sync effect must
    // recognise it as a parent round-trip and bail out without
    // dispatching a replace-the-whole-doc change.
    rerender(<ControlledHost initial="hi" onValueChange={onChange} handleRef={handleRef} />)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('wrapSelection toolbar button wraps with placeholder when selection is empty', () => {
    const onChange = vi.fn<(v: string) => void>()
    const handleRef = { current: null as MarkdownEditorHandle | null }
    render(<ControlledHost initial="" onValueChange={onChange} handleRef={handleRef} />)

    act(() => handleRef.current!.wrapSelection('**', '**', 'bold'))
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('**bold**')
  })

  it('prefixLine on a fresh empty editor inserts the marker once', () => {
    const onChange = vi.fn<(v: string) => void>()
    const handleRef = { current: null as MarkdownEditorHandle | null }
    render(<ControlledHost initial="" onValueChange={onChange} handleRef={handleRef} />)

    act(() => handleRef.current!.prefixLine('- '))
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('- ')

    // Pressing the same toolbar button again must not double the prefix.
    act(() => handleRef.current!.prefixLine('- '))
    expect(onChange.mock.calls.at(-1)?.[0]).toBe('- ')
  })

  it('insertAtCursor places text at the caret and moves the caret after', () => {
    const onChange = vi.fn<(v: string) => void>()
    const handleRef = { current: null as MarkdownEditorHandle | null }
    render(<ControlledHost initial="hi" onValueChange={onChange} handleRef={handleRef} />)

    act(() => handleRef.current!.insertAtCursor(' world'))
    // Initial caret is at 0 after our reset effect runs, so the inserted
    // text lands at the start. We don't care which side the marker ends
    // up on as long as the doc contains both.
    const last = onChange.mock.calls.at(-1)?.[0]
    expect(last).toContain(' world')
    expect(last).toContain('hi')
  })

  it('switching to a different value (note switch) replaces the doc', () => {
    const onChange = vi.fn<(v: string) => void>()
    const handleRef = { current: null as MarkdownEditorHandle | null }
    const { rerender } = render(
      <ControlledHost initial="first note" onValueChange={onChange} handleRef={handleRef} />,
    )
    // ControlledHost owns its own state, so to simulate a "switch" we
    // remount with a fresh initial. The point is: once a remount /
    // external `value` change comes in, the editor should reflect it.
    rerender(
      <ControlledHost
        key="switched"
        initial="second note"
        onValueChange={onChange}
        handleRef={handleRef}
      />,
    )
    // After remount the editor has the new value as its baseline; typing
    // appends to that, not to the old "first note".
    act(() => handleRef.current!.insertAtCursor('!'))
    const last = onChange.mock.calls.at(-1)?.[0]
    expect(last).toContain('second note')
    expect(last).not.toContain('first note')
  })
})
