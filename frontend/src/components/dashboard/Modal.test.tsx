import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Modal } from './Modal'

/**
 * Reproduces the "input loses focus after one keystroke" bug that affected
 * forms rendered inside a Modal. The parent recreates the inline `onClose`
 * closure on every render (as OwnerHeadteacherPage does), so the old focus
 * effect (which depended on `onClose`) re-ran on every keystroke and moved
 * focus to the dialog panel. The fix makes the focus effect depend only on
 * `open` and keeps the latest `onClose` in a ref.
 */
function ControlledModalHarness() {
  const [firstName, setFirstName] = useState('')
  return (
    <Modal open onClose={() => setFirstName((current) => current)} title="Create account" size="lg">
      <label htmlFor="first-name">First name</label>
      <input
        id="first-name"
        value={firstName}
        onChange={(event) => setFirstName(event.target.value)}
      />
    </Modal>
  )
}

describe('Modal', () => {
  it('keeps focus inside a form input while typing', () => {
    render(<ControlledModalHarness />)

    const input = screen.getByLabelText('First name') as HTMLInputElement
    input.focus()
    expect(document.activeElement).toBe(input)

    fireEvent.change(input, { target: { value: 'A' } })
    fireEvent.change(input, { target: { value: 'Ad' } })
    fireEvent.change(input, { target: { value: 'Ada' } })

    expect(document.activeElement).toBe(input)
  })

  it('calls the latest onClose handler on Escape after a re-render', () => {
    const handler = () => {
      document.body.dataset.closed = 'true'
    }
    const { rerender } = render(
      <Modal open onClose={() => undefined} title="Test">
        <p>Content</p>
      </Modal>,
    )

    rerender(
      <Modal open onClose={handler} title="Test">
        <p>Content</p>
      </Modal>,
    )

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(document.body.dataset.closed).toBe('true')
  })
})
