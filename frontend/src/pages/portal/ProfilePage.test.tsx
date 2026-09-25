import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'
import { ToastProvider } from '@/components/dashboard/Toast'

const { refreshUserMock, changePasswordMock, uploadPictureMock, deletePictureMock, pushMock } =
  vi.hoisted(() => ({
    refreshUserMock: vi.fn(),
    changePasswordMock: vi.fn(),
    uploadPictureMock: vi.fn(),
    deletePictureMock: vi.fn(),
    pushMock: vi.fn(),
  }))

let authUser: Record<string, unknown> | null = {
  id: 'user-1',
  fullName: 'Ada Lovelace',
  email: 'ada@school.edu',
  phone: '0244111222',
  profilePictureUrl: 'https://cdn.prps.dev/profile.png',
  status: 'ACTIVE' as const,
  lastLoginAt: '2026-08-17T10:00:00.000Z',
  mustChangePassword: false,
  createdAt: '2025-09-01T00:00:00.000Z',
  staffId: 'HT-2026-001',
  category: 'ACADEMIC',
  position: 'Headteacher',
  roles: ['HEADTEACHER'],
  permissions: ['pupils.view', 'staff.manage'],
}

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: authUser,
    status: 'authenticated',
    refreshUser: refreshUserMock,
    logout: vi.fn(),
  }),
}))

vi.mock('@/lib/api', () => ({
  api: {
    changePassword: changePasswordMock,
    uploadProfilePicture: uploadPictureMock,
    deleteProfilePicture: deletePictureMock,
  },
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
    <MemoryRouter initialEntries={['/profile']}>
      <ToastProvider>
        <ProfilePage />
      </ToastProvider>
    </MemoryRouter>,
  )
}

describe('ProfilePage', () => {
  beforeEach(() => {
    authUser = {
      id: 'user-1',
      fullName: 'Ada Lovelace',
      email: 'ada@school.edu',
      phone: '0244111222',
      profilePictureUrl: 'https://cdn.prps.dev/profile.png',
      status: 'ACTIVE' as const,
      lastLoginAt: '2026-08-17T10:00:00.000Z',
      mustChangePassword: false,
      createdAt: '2025-09-01T00:00:00.000Z',
      staffId: 'HT-2026-001',
      category: 'ACADEMIC',
      position: 'Headteacher',
      roles: ['HEADTEACHER'],
      permissions: ['pupils.view', 'staff.manage'],
    }
    refreshUserMock.mockReset().mockResolvedValue(null)
    changePasswordMock.mockReset()
    uploadPictureMock.mockReset()
    deletePictureMock.mockReset()
    pushMock.mockReset()
  })

  it('renders identity, account details and security sections', () => {
    renderPage()

    expect(screen.getByRole('heading', { name: 'Ada Lovelace' })).toBeInTheDocument()
    expect(screen.getAllByText('ada@school.edu').length).toBeGreaterThan(0)
    expect(screen.getAllByText('HT-2026-001').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Headteacher').length).toBeGreaterThan(0)
    expect(screen.getByText('Account Details')).toBeInTheDocument()
    expect(screen.getAllByText('Security').length).toBeGreaterThan(0)
    expect(screen.getByText('JPG, PNG, WebP or GIF / Maximum 5 MB')).toBeInTheDocument()
  })

  it('shows no permission UI or role/permission editing controls', () => {
    renderPage()

    expect(screen.queryByText(/Access & Permissions/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/read-only/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/permissions/i)).not.toBeInTheDocument()
    expect(screen.queryByText('pupils.view')).not.toBeInTheDocument()
    expect(screen.queryByText('staff.manage')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit role/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /assign permission/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /change role/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /edit permission/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /add permission/i })).not.toBeInTheDocument()
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
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('rejects mismatched confirmation', async () => {
    renderPage()

    fireEvent.change(screen.getByLabelText(/^current password/i), {
      target: { value: 'oldPass1' },
    })
    fireEvent.change(screen.getByLabelText(/^new password/i), {
      target: { value: 'Secure123' },
    })
    fireEvent.change(screen.getByLabelText(/^confirm new password/i), {
      target: { value: 'Secure124' },
    })
    fireEvent.click(screen.getByRole('button', { name: /update password/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Passwords do not match.')
    expect(changePasswordMock).not.toHaveBeenCalled()
  })

  it('submits a valid password change', async () => {
    changePasswordMock.mockResolvedValue(null)
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
      expect(changePasswordMock).toHaveBeenCalledWith('oldPass1', 'Secure123')
    })
    expect(pushMock).toHaveBeenCalledWith('success', 'Password updated successfully.')
  })

  it('surfaces backend field errors when password change fails', async () => {
    const err = new Error('Validation failed') as Error & { fieldErrors: Record<string, string> }
    err.fieldErrors = { currentPassword: 'Current password is incorrect.' }
    changePasswordMock.mockRejectedValue(err)
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

    expect(await screen.findByText('Current password is incorrect.')).toBeInTheDocument()
    expect(pushMock).not.toHaveBeenCalled()
  })

  it('shows upload helper and remove photo when a picture exists', () => {
    renderPage()

    expect(screen.getByRole('button', { name: /change photo/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /remove photo/i })).toBeInTheDocument()
    expect(screen.getByLabelText('Change profile picture')).toBeInTheDocument()
  })

  it('renders initials-friendly upload state when no picture exists', () => {
    authUser = {
      ...(authUser as Record<string, unknown>),
      profilePictureUrl: null,
    }
    renderPage()

    expect(screen.getByRole('button', { name: /upload photo/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /remove photo/i })).not.toBeInTheDocument()
  })

  it('renders an Owner account without staff-only fields', () => {
    authUser = {
      ...(authUser as Record<string, unknown>),
      fullName: 'Owning Administrator',
      roles: ['OWNER'],
      staffId: null,
      position: null,
      category: null,
      permissions: ['owner.manage'],
    }
    renderPage()

    expect(screen.getByRole('heading', { name: 'Owning Administrator' })).toBeInTheDocument()
    expect(screen.getAllByText('Owner').length).toBeGreaterThan(0)
    expect(screen.queryByText('Staff ID')).not.toBeInTheDocument()
    expect(screen.queryByText('Position')).not.toBeInTheDocument()
    expect(screen.queryByText('owner.manage')).not.toBeInTheDocument()
  })

  it('renders an Accountant account with its real role label', () => {
    authUser = {
      ...(authUser as Record<string, unknown>),
      fullName: 'Finance Officer',
      roles: ['ACCOUNTANT'],
      staffId: 'PRPS-STF-0002',
      position: 'ACCOUNTANT',
      category: 'NON_TEACHING',
      permissions: ['finance.view', 'payments.record'],
    }
    renderPage()

    expect(screen.getByRole('heading', { name: 'Finance Officer' })).toBeInTheDocument()
    expect(screen.getAllByText('Accountant / Finance').length).toBeGreaterThan(0)
    expect(screen.getAllByText('PRPS-STF-0002').length).toBeGreaterThan(0)
    expect(screen.queryByText('finance.view')).not.toBeInTheDocument()
    expect(screen.queryByText('payments.record')).not.toBeInTheDocument()
  })

  it('renders a teacher account with role and position labels', () => {
    authUser = {
      ...(authUser as Record<string, unknown>),
      fullName: 'Subject Teacher One',
      roles: ['SUBJECT_TEACHER'],
      staffId: 'PRPS-STF-0003',
      position: 'SUBJECT_TEACHER',
      category: 'TEACHING',
      permissions: ['academic.view', 'sba.view'],
    }
    renderPage()

    expect(screen.getByRole('heading', { name: 'Subject Teacher One' })).toBeInTheDocument()
    expect(screen.getAllByText('Subject Teacher').length).toBeGreaterThan(0)
    expect(screen.getAllByText('PRPS-STF-0003').length).toBeGreaterThan(0)
    expect(screen.queryByText('academic.view')).not.toBeInTheDocument()
  })
})
