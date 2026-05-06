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
})
