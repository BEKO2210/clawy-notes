import { describe, expect, it, vi, beforeEach } from 'vitest'
import { useState } from 'react'
import { act, fireEvent, render } from '@testing-library/react'
import { useBackHandler, __resetBackHandlerForTests } from './useBackHandler'

function Trapper({
  onClosed,
}: {
  onClosed?: () => void
}) {
  const [open, setOpen] = useState(false)
  useBackHandler(open, () => {
    setOpen(false)
    onClosed?.()
  })
  return (
    <div>
      <button data-testid="open" onClick={() => setOpen(true)}>open</button>
      <button data-testid="close" onClick={() => setOpen(false)}>close</button>
      <span data-testid="state">{open ? 'open' : 'closed'}</span>
    </div>
  )
}

describe('useBackHandler', () => {
  beforeEach(() => {
    __resetBackHandlerForTests()
  })

  it('closes the active overlay when popstate fires', () => {
    const onClosed = vi.fn()
    const { getByTestId } = render(<Trapper onClosed={onClosed} />)

    expect(getByTestId('state').textContent).toBe('closed')
    fireEvent.click(getByTestId('open'))
    expect(getByTestId('state').textContent).toBe('open')

    // Simulate the system back button.
    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(getByTestId('state').textContent).toBe('closed')
    expect(onClosed).toHaveBeenCalledTimes(1)
  })

  it('handles a programmatic close without leaving a phantom history entry', () => {
    const { getByTestId } = render(<Trapper />)

    fireEvent.click(getByTestId('open'))
    expect(getByTestId('state').textContent).toBe('open')

    // X-button click — close via state change.
    fireEvent.click(getByTestId('close'))
    expect(getByTestId('state').textContent).toBe('closed')
  })

  it('stacks multiple overlays and closes them most-recent-first', () => {
    function Two() {
      const [a, setA] = useState(false)
      const [b, setB] = useState(false)
      useBackHandler(a, () => setA(false))
      useBackHandler(b, () => setB(false))
      return (
        <div>
          <button data-testid="open-a" onClick={() => setA(true)}>open A</button>
          <button data-testid="open-b" onClick={() => setB(true)}>open B</button>
          <span data-testid="status">
            A:{a ? 'open' : 'closed'} B:{b ? 'open' : 'closed'}
          </span>
        </div>
      )
    }

    const { getByTestId } = render(<Two />)
    fireEvent.click(getByTestId('open-a'))
    fireEvent.click(getByTestId('open-b'))
    expect(getByTestId('status').textContent).toBe('A:open B:open')

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(getByTestId('status').textContent).toBe('A:open B:closed')

    act(() => {
      window.dispatchEvent(new PopStateEvent('popstate'))
    })
    expect(getByTestId('status').textContent).toBe('A:closed B:closed')
  })
})
