import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ParentProfilePage } from './ParentProfilePage'
import { ToastProvider } from '@/components/dashboard/Toast'

const { parentChangePasswordMock, pushMock } = vi.hoisted(() => ({
  parentChangePasswordMock: vi.fn(),
  pushMock: vi.fn(),
}))

let parentProfile: Record<string, unknown> | null = {
  id: 'parent-1',
  fullName: 'Kwame Mensah',
  email: 'kwame@family.edu',
  phone: '0201234567',
  status: 'ACTIVE' as const,
  mustChangePassword: false,
  linkedPupilCount: 2,
}

vi.mock('@/auth/ParentAuthContext', () => ({
  useParentAuth: () => ({
    profile: parentProfile,
    status: 'authenticated',
    refreshProfile: vi.fn(),
    logout: vi.fn(),
  }),
}))

vi.mock('@/lib/api', () => ({
  api: { parentChangePassword: parentChangePasswordMock },
}))

vi.mock('@/components/dashboard/Toast', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>
  return {
    ...actual,
    useToast: () => ({ push: pushMock }),
  }
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/parent/profile']}>
      <ToastProvider>
        <ParentProfilePage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('ParentProfilePage', () => {
  beforeEach(() => {
    parentProfile = {
      id: 'parent-1',
      fullName: 'Kwame Mensah',
      email: 'kwame@family.edu',
      phone: '0201234567',
      status: 'ACTIVE' as const,
      mustChangePassword: false,
      linkedPupilCount: 2,
    }
    parentChangePasswordMock.mockReset()
    pushMock.mockReset()
  })

  it('renders parent identity and account information', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Kwame Mensah' })).toBeInTheDocument()
    expect(screen.getAllByText('kwame@family.edu').length).toBeGreaterThan(0)
    expect(screen.getAllByText('0201234567').length).toBeGreaterThan(0)
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('Account Details')).toBeInTheDocument()
    expect(screen.getAllByText('Security').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getByText('Parent')).toBeInTheDocument()
  })

  it('does not expose staff-only fields', () => {
    renderPage()

    expect(screen.queryByText('Staff ID')).not.toBeInTheDocument()
    expect(screen.queryByText(/permissions/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove photo/i })).not.toBeInTheDocument()
  })

  it('shows password fields with show/hide toggles', () => {
    renderPage()

    const current = screen.getByLabelText(/^current password/i) as HTMLInputElement
    expect(current.type).toBe('password')
    fireEvent.click(screen.getByRole('button', { name: 'Show current password' }))
    expect(current.type).toBe('text')
  })

  it('validates password requirements before submitting', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText(/^current password/i), {
      target: { value: 'oldPass1' },
    })
    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'short' },
    })
    fireEvent.change(screen.getByLabelText(/^confirm new password/i), {
      target: { value: 'short' },
    })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Password must be at least 8 characters.',
    )
    expect(parentChangePasswordMock).not.toHaveBeenCalled()
  })

  it('submits a valid password change', async () => {
    parentChangePasswordMock.mockResolvedValue(null)
    renderPage()

    fireEvent.change(screen.getByLabelText(/^current password/i), {
      target: { value: 'oldPass1' },
    })
    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'Secure123' },
    })
    fireEvent.change(screen.getByLabelText(/^confirm new password/i), {
      target: { value: 'Secure123' },
    })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    await waitFor(() => {
      expect(parentChangePasswordMock).toHaveBeenCalledWith('oldPass1', 'Secure123')
    })
    expect(pushMock).toHaveBeenCalledWith('success', 'Password updated successfully.')
  })

  it('shows a loading state when no profile is available', () => {
    parentProfile = null
    renderPage()

    expect(screen.getByText('Loading your profile…')).toBeInTheDocument()
  })
})
