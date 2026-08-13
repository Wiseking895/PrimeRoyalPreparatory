import { fireEvent, render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import StaffLoginPage from './StaffLoginPage'

function renderPage() {
  return render(
    <MemoryRouter>
      <StaffLoginPage />
    </MemoryRouter>,
  )
}

describe('StaffLoginPage', () => {
  it('renders the Staff Portal landing content', () => {
    const { container } = renderPage()

    const text = container.textContent ?? ''
    expect(container.querySelector('h1')?.textContent).toContain('Welcome to the Staff Portal')
    expect(text).toContain('Staff Sign In')
    expect(text).toContain('Owner / Proprietress')
    expect(text).toContain('Headteacher')
    expect(text).toContain('Accountant')
    expect(text).toContain('Teachers')
    expect(text).toContain('Non-Teaching Staff')
    expect(text).toContain('Parent Portal')
  })

  it('shows the Phase 2 notice when the sign-in form is submitted', () => {
    const { container } = renderPage()

    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    fireEvent.submit(form as HTMLFormElement)

    expect(container.textContent).toContain('will be available in Phase 2')
  })
})
