import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChangePasswordPage } from './ChangePasswordPage'

const { firstPasswordChangeMock, refreshUserMock, navigateMock } = vi.hoisted(() => ({
  firstPasswordChangeMock: vi.fn(),
  refreshUserMock: vi.fn(),
  navigateMock: vi.fn(),
}))

const pendingUser = {
  id: 'ht-1',
  fullName: 'Ada Lovelace',
  email: 'ht@school.edu',
  phone: null,
  profilePictureUrl: null,
  status: 'ACTIVE' as const,
  lastLoginAt: null,
  mustChangePassword: true,
  createdAt: '2026-08-17T00:00:00.000Z',
  staffId: 'HT-2026-001',
  roles: ['HEADTEACHER'],
  permissions: [],
}

const settledUser = { ...pendingUser, mustChangePassword: false }

let authStatus: 'unauthenticated' | 'authenticated' | 'loading' = 'authenticated'
let authUser: Record<string, unknown> | null = pendingUser

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: authUser,
    status: authStatus,
    refreshUser: refreshUserMock,
    logout: vi.fn(),
  }),
}))

vi.mock('@/auth/dashboardHome', () => ({
  dashboardHomeFor: () => '/headteacher/dashboard',
}))

vi.mock('@/lib/api', () => ({
  api: { firstPasswordChange: firstPasswordChangeMock },
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
    <MemoryRouter initialEntries={['/change-password']}>
      <ChangePasswordPage />
    </MemoryRouter>,
  )
}

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    authStatus = 'authenticated'
    authUser = pendingUser
    firstPasswordChangeMock.mockReset()
    refreshUserMock.mockReset()
    navigateMock.mockReset()
    refreshUserMock.mockResolvedValue(settledUser)
  })

  it('renders the forced password change form for a pending user', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Set a new password' })).toBeInTheDocument()
    expect(screen.getByLabelText(/^new password/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/^confirm new password/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /change password/i })).toBeInTheDocument()
  })

  it('redirects to the dashboard when the user has already set a password', () => {
    authUser = settledUser
    renderPage()

    expect(navigateMock).not.toHaveBeenCalled()
    expect(
      screen.queryByRole('heading', { name: 'Set a new password' }),
    ).not.toBeInTheDocument()
  })

  it('validates password requirements before submitting', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'short' },
    })
    fireEvent.change(screen.getByLabelText(/^confirm new password/i), {
      target: { value: 'short' },
    })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters.',
    )
    expect(firstPasswordChangeMock).not.toHaveBeenCalled()
  })

  it('validates that the password contains both letters and numbers', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'onlyletters' },
    })
    fireEvent.change(screen.getByLabelText(/^confirm new password/i), {
      target: { value: 'onlyletters' },
    })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must include letters and numbers.',
    )
    expect(firstPasswordChangeMock).not.toHaveBeenCalled()
  })

  it('rejects a mismatched confirmation', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'Secure123' },
    })
    fireEvent.change(screen.getByLabelText(/^confirm new password/i), {
      target: { value: 'Secure124' },
    })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(firstPasswordChangeMock).not.toHaveBeenCalled()
  })

  it('submits and navigates to the role dashboard on success', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'Secure123' },
    })
    fireEvent.change(screen.getByLabelText(/^confirm new password/i), {
      target: { value: 'Secure123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByRole('button', { name: /change password/i })).toBeInTheDocument()
    expect(firstPasswordChangeMock).toHaveBeenCalledWith('Secure123', 'Secure123')
    expect(refreshUserMock).toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith('/headteacher/dashboard', { replace: true })
  })

  it('surfaces the backend field errors when the change fails', async () => {
    const err = new Error('Validation failed') as Error & { fieldErrors: Record<string, string> }
    err.fieldErrors = { newPassword: 'Password was recently used.' }
    firstPasswordChangeMock.mockRejectedValueOnce(err)
    renderPage()

    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'Secure123' },
    })
    fireEvent.change(screen.getByLabelText(/^confirm new password/i), {
      target: { value: 'Secure123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    expect(await screen.findByText('Password was recently used.')).toBeInTheDocument()
    expect(navigateMock).not.toHaveBeenCalled()
  })
})
