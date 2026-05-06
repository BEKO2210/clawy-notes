import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { Picker } from './Picker'

describe('<Picker />', () => {
  it('renders nothing when open=false', () => {
    const { container } = render(
      <Picker open={false} onClose={() => {}}>
        <span>hidden</span>
      </Picker>,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders content with the title when open', () => {
    render(
      <Picker open onClose={() => {}} title="Tags">
        <button>option-1</button>
      </Picker>,
    )
    expect(screen.getByRole('menu', { name: 'Tags' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'option-1' })).toBeDefined()
  })

  it('closes on Escape', () => {
    const onClose = vi.fn()
    render(
      <Picker open onClose={onClose}>
        <span>content</span>
      </Picker>,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalled()
  })

  it('closes when the backdrop is clicked', () => {
    const onClose = vi.fn()
    render(
      <Picker open onClose={onClose}>
        <span>content</span>
      </Picker>,
    )
    // Click outside the menu sheet (mousedown bubbles to document and triggers the outside-click handler).
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalled()
  })
})
