import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import StaffLoginPage from './StaffLoginPage'

const loginMock = vi.fn()

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    status: 'unauthenticated',
    isOwner: false,
    isHeadteacher: false,
    hasPermission: () => false,
    login: loginMock,
    logout: vi.fn(),
  }),
}))

vi.mock('@/auth/dashboardHome', () => ({
  dashboardHomeFor: () => '/headteacher/dashboard',
}))

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/staff/login']}>
      <StaffLoginPage />
    </MemoryRouter>,
  )
}

describe('StaffLoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset()
    loginMock.mockResolvedValue({ id: 'user-1', roles: ['HEADTEACHER'] })
  })

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

  it('shows a validation message when submitting without credentials', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(loginMock).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('staff ID, email or phone')
  })

  it('signs in with the entered identifier and password', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Staff ID or school email'), {
      target: { value: 'PRPS-HT-001' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect((await screen.findAllByText(/no public sign-up/i)).length).toBeGreaterThan(0)
    expect(loginMock).toHaveBeenCalledWith('PRPS-HT-001', 'secret123')
  })

  it('surfaces the backend error message when sign in fails', async () => {
    loginMock.mockRejectedValueOnce(new Error('Invalid email, staff ID, or password.'))
    renderPage()

    fireEvent.change(screen.getByLabelText('Staff ID or school email'), {
      target: { value: 'PRPS-HT-001' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass1' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email, staff ID, or password.')
  })
})