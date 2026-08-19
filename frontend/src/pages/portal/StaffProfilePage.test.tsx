import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffProfilePage } from './StaffProfilePage'
import type { CreateStaffResult, RoleDefinition, StaffView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  getStaff: vi.fn(),
  listRoles: vi.fn(),
  updateStaff: vi.fn(),
  setStaffStatus: vi.fn(),
  resendStaffInvitation: vi.fn(),
  assignRole: vi.fn(),
  removeRole: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))

const STAFF_PERMISSIONS = [
  'staff.view',
  'staff.create',
  'staff.update',
  'staff.assign_role',
  'staff.remove_role',
]

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'ht-1',
      fullName: 'Grace Hopper',
      email: 'grace@school.edu',
      phone: null,
      profilePictureUrl: null,
      status: 'ACTIVE',
      lastLoginAt: null,
      mustChangePassword: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      staffId: 'PRPS-HT-001',
      category: 'LEADERSHIP',
      position: null,
      roles: ['HEADTEACHER'],
      permissions: STAFF_PERMISSIONS,
    },
    hasPermission: (key: string) => STAFF_PERMISSIONS.includes(key),
  }),
}))

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('@/components/dashboard/Toast', () => ({
  useToast: () => ({ push: pushMock }),
}))

const assignableRoles: RoleDefinition[] = [
  { name: 'CLASS_TEACHER', label: 'Class Teacher', description: '', permissions: [] },
  { name: 'SUPPORT_STAFF', label: 'Support Staff', description: '', permissions: [] },
]

function staffFixture(overrides: Partial<StaffView> = {}): StaffView {
  return {
    id: 'st-1',
    fullName: 'Katherine Johnson',
    email: 'katherine@school.edu',
    phone: '+233 20 000 0001',
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: null,
    mustChangePassword: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    staffId: 'PRPS-STF-0001',
    category: 'TEACHING',
    position: 'CLASS_TEACHER',
    address: 'Accra',
    dateJoined: '2026-01-02T00:00:00.000Z',
    responsibilities: 'Maths lead',
    roles: ['CLASS_TEACHER'],
    permissions: [],
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/headteacher/staff/st-1']}>
      <Routes>
        <Route path="/headteacher/staff/:id" element={<StaffProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('StaffProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    apiMock.getStaff.mockResolvedValue(staffFixture())
    apiMock.listRoles.mockResolvedValue(assignableRoles)
    apiMock.setStaffStatus.mockImplementation(
      async (_id: string, status: 'ACTIVE' | 'INACTIVE') => staffFixture({ status }),
    )
    apiMock.updateStaff.mockImplementation(async (_id: string, input: Record<string, unknown>) =>
      staffFixture({ position: input.position as string }),
    )
    apiMock.resendStaffInvitation.mockResolvedValue({
      staff: staffFixture(),
      invitation: { status: 'sent', transport: 'smtp', messageId: 'm2' },
    } satisfies CreateStaffResult)
  })

  it('renders the staff profile with position, category and contact details', async () => {
    renderPage()

    expect(await screen.findByText('Katherine Johnson')).toBeInTheDocument()
    expect(screen.getByText('PRPS-STF-0001 · katherine@school.edu')).toBeInTheDocument()
    expect(screen.getAllByText('Class Teacher').length).toBeGreaterThan(0)
    expect(screen.getAllByText('TEACHING').length).toBeGreaterThan(0)
    expect(screen.getByText('+233 20 000 0001')).toBeInTheDocument()
    expect(screen.getByText('Maths lead')).toBeInTheDocument()
    expect(screen.getByText('Awaiting password change')).toBeInTheDocument()
  })

  it('deactivates a staff account through the confirmation dialog', async () => {
    renderPage()
    await screen.findByText('Katherine Johnson')

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))
    const dialog = screen.getByRole('dialog', { name: 'Deactivate account' })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /I understand this action/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => {
      expect(apiMock.setStaffStatus).toHaveBeenCalledWith('st-1', 'INACTIVE')
    })
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('deactivated'))
    expect(await screen.findByText('Inactive')).toBeInTheDocument()
  })

  it('resends the invitation and reports the fresh delivery status', async () => {
    renderPage()
    await screen.findByText('Katherine Johnson')

    fireEvent.click(screen.getByRole('button', { name: 'Resend invitation' }))
    const dialog = screen.getByRole('dialog', { name: 'Resend invitation' })
    fireEvent.click(within(dialog).getByRole('checkbox', { name: /I understand this action/i }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Resend invitation' }))

    await waitFor(() => {
      expect(apiMock.resendStaffInvitation).toHaveBeenCalledWith('st-1')
    })
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('sent again'))
    expect(await screen.findByText('Invitation sent')).toBeInTheDocument()
  })

  it('edits the profile and updates the position', async () => {
    renderPage()
    await screen.findByText('Katherine Johnson')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText(/^Position/), { target: { value: 'SUBJECT_TEACHER' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(apiMock.updateStaff).toHaveBeenCalledWith(
        'st-1',
        expect.objectContaining({ position: 'SUBJECT_TEACHER' }),
      )
    })
    expect(pushMock).toHaveBeenCalledWith('success', 'Staff profile updated.')
    expect((await screen.findAllByText('Subject Teacher')).length).toBeGreaterThan(0)
  })

  it('shows an error state when the profile cannot be loaded', async () => {
    apiMock.getStaff.mockRejectedValue(new Error('Staff account not found.'))
    renderPage()

    expect(await screen.findByText('Staff account not found.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Back to staff' })).toBeInTheDocument()
  })
})
