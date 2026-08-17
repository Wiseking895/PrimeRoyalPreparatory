import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LoginPage } from './LoginPage'

const loginMock = vi.fn()
const navigateMock = vi.fn()

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
  dashboardHomeFor: () => '/owner/dashboard',
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    useNavigate: () => navigateMock,
  }
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/login']}>
      <LoginPage />
    </MemoryRouter>,
  )
}

describe('LoginPage', () => {
  beforeEach(() => {
    loginMock.mockReset()
    navigateMock.mockReset()
    loginMock.mockResolvedValue({ id: 'user-1', roles: ['OWNER'] })
  })

  it('renders the staff login form', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'PRPS Staff Portal' })).toBeInTheDocument()
    expect(screen.getByLabelText('Email, staff ID or phone')).toBeInTheDocument()
    expect(screen.getByLabelText('Password')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument()
  })

  it('shows a validation message when submitting empty', () => {
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(loginMock).not.toHaveBeenCalled()
    expect(screen.getByRole('alert').textContent).toContain('staff ID or phone')
  })

  it('calls login and navigates to the dashboard on success', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText('Email, staff ID or phone'), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret123' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('button', { name: /sign in/i })).toBeInTheDocument()
    expect(loginMock).toHaveBeenCalledWith('ada@example.com', 'secret123')
    expect(navigateMock).toHaveBeenCalledWith('/owner/dashboard', { replace: true })
  })

  it('surfaces the backend error message when sign in fails', async () => {
    loginMock.mockRejectedValueOnce(new Error('Invalid email, staff ID, or password.'))
    renderPage()

    fireEvent.change(screen.getByLabelText('Email, staff ID or phone'), {
      target: { value: 'ada@example.com' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass1' } })
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email, staff ID, or password.')
    expect(navigateMock).not.toHaveBeenCalled()
  })
})