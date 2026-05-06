import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ErrorBoundary } from './ErrorBoundary'

function Boom(): never {
  throw new Error('kaboom')
}

describe('<ErrorBoundary />', () => {
  let originalError: typeof console.error
  beforeEach(() => {
    originalError = console.error
    console.error = vi.fn()
  })
  afterEach(() => {
    console.error = originalError
  })

  it('renders children when nothing throws', () => {
    render(
      <ErrorBoundary>
        <div>safe child</div>
      </ErrorBoundary>,
    )
    expect(screen.getByText('safe child')).toBeDefined()
  })

  it('renders the fallback UI when a child throws', () => {
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    expect(screen.getByRole('alert')).toBeDefined()
    expect(screen.getByText('Something broke')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Try again' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Reload' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Reset data' })).toBeDefined()
  })

  it('asks for confirmation before wiping data', async () => {
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {})
    const reload = vi.fn()
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, reload },
    })
    const confirm = vi.fn().mockReturnValue(false)
    Object.defineProperty(window, 'confirm', { configurable: true, value: confirm })

    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Reset data' }))
    expect(confirm).toHaveBeenCalled()
    expect(removeItem).not.toHaveBeenCalled()
    expect(reload).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Reset data' }))
    // resetData is now async — it waits for IndexedDB.deleteDatabase() to
    // resolve before reloading. Wait until both side effects fire.
    await vi.waitFor(() => {
      expect(removeItem).toHaveBeenCalledWith('clawy-notes-storage')
      expect(reload).toHaveBeenCalled()
    })

    removeItem.mockRestore()
  })
})
