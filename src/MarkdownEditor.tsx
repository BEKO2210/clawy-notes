import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { EditorView, minimalSetup } from 'codemirror'
import { Compartment, EditorState } from '@codemirror/state'
import { markdown } from '@codemirror/lang-markdown'

export interface MarkdownEditorHandle {
  insertAtCursor: (text: string) => void
  focus: () => void
}

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  darkMode: boolean
}

const baseTheme = EditorView.theme({
  '&': {
    height: '100%',
    fontSize: '14px',
    backgroundColor: 'var(--bg-primary)',
    color: 'var(--text-primary)',
  },
  '&.cm-editor.cm-focused': { outline: 'none' },
  '.cm-content': {
    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
    padding: '16px 20px',
    lineHeight: '1.7',
    caretColor: 'var(--accent)',
  },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)' },
  '.cm-gutters': { display: 'none' },
  '.cm-scroller': { fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
  '.cm-activeLine': { backgroundColor: 'transparent' },
  '.cm-selectionBackground, & ::selection': {
    backgroundColor: 'rgba(14, 165, 233, 0.18) !important',
  },
  '.cm-line': { padding: '0 2px' },
})

export const MarkdownEditor = forwardRef<MarkdownEditorHandle, MarkdownEditorProps>(
  function MarkdownEditor({ value, onChange, darkMode }, ref) {
    const containerRef = useRef<HTMLDivElement>(null)
    const viewRef = useRef<EditorView | null>(null)
    const onChangeRef = useRef(onChange)
    const darkCompartment = useRef(new Compartment())

    onChangeRef.current = onChange

    useImperativeHandle(
      ref,
      () => ({
        insertAtCursor(text) {
          const view = viewRef.current
          if (!view) return
          const { from, to } = view.state.selection.main
          view.dispatch({
            changes: { from, to, insert: text },
            selection: { anchor: from + text.length },
          })
          view.focus()
        },
        focus() {
          viewRef.current?.focus()
        },
      }),
      [],
    )

    // Mount once
    useEffect(() => {
      if (!containerRef.current) return
      const view = new EditorView({
        state: EditorState.create({
          doc: value,
          extensions: [
            minimalSetup,
            markdown(),
            EditorView.lineWrapping,
            baseTheme,
            darkCompartment.current.of(EditorView.theme({}, { dark: darkMode })),
            EditorView.updateListener.of((update) => {
              if (update.docChanged) {
                onChangeRef.current(update.state.doc.toString())
              }
            }),
          ],
        }),
        parent: containerRef.current,
      })
      viewRef.current = view
      return () => {
        view.destroy()
        viewRef.current = null
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Sync external value -> editor when they diverge (e.g. switching notes)
    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      const current = view.state.doc.toString()
      if (current === value) return
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      })
    }, [value])

    // Swap dark-mode flag without rebuilding the editor
    useEffect(() => {
      const view = viewRef.current
      if (!view) return
      view.dispatch({
        effects: darkCompartment.current.reconfigure(
          EditorView.theme({}, { dark: darkMode }),
        ),
      })
    }, [darkMode])

    return <div ref={containerRef} className="h-full w-full overflow-hidden" />
  },
)
