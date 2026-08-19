import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { StaffManagementPage } from './StaffManagementPage'
import type { CreateStaffResult, StaffStats, StaffView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listStaff: vi.fn(),
  staffStats: vi.fn(),
  createStaff: vi.fn(),
  listRoles: vi.fn(),
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

function staffFixture(overrides: Partial<StaffView> = {}): StaffView {
  return {
    id: 'st-1',
    fullName: 'Katherine Johnson',
    email: 'katherine@school.edu',
    phone: null,
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: null,
    mustChangePassword: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    staffId: 'PRPS-STF-0001',
    category: 'TEACHING',
    position: 'CLASS_TEACHER',
    address: 'Accra',
    dateJoined: '2026-01-01T00:00:00.000Z',
    responsibilities: null,
    roles: ['CLASS_TEACHER'],
    permissions: [],
    ...overrides,
  }
}

function statsFixture(): StaffStats {
  return {
    total: 1,
    teaching: 1,
    nonTeaching: 0,
    active: 1,
    inactive: 0,
    byPosition: { CLASS_TEACHER: 1 },
    recentActivity: [],
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/headteacher/staff']}>
      <StaffManagementPage />
    </MemoryRouter>,
  )
}

describe('StaffManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    apiMock.listStaff.mockResolvedValue([staffFixture()])
    apiMock.staffStats.mockResolvedValue(statsFixture())
    apiMock.createStaff.mockResolvedValue({
      staff: staffFixture(),
      invitation: { status: 'sent', transport: 'smtp', messageId: 'm1' },
    } satisfies CreateStaffResult)
  })

  it('renders the staff list with position labels', async () => {
    renderPage()

    expect((await screen.findAllByText('Katherine Johnson')).length).toBeGreaterThan(0)
    expect(screen.getByText('PRPS-STF-0001 · katherine@school.edu')).toBeInTheDocument()
    expect(screen.getAllByText('Class Teacher').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
  })

  it('shows the staff statistics cards', async () => {
    renderPage()

    expect(await screen.findByText('Total Staff')).toBeInTheDocument()
    expect(screen.getByText('Teaching Staff')).toBeInTheDocument()
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  it('searches staff by query after the debounce', async () => {
    renderPage()
    await screen.findAllByText('Katherine Johnson')

    fireEvent.change(screen.getByLabelText('Search staff'), { target: { value: 'Katherine' } })

    await waitFor(() => {
      expect(apiMock.listStaff).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'Katherine' }),
      )
    })
  })

  it('filters by category on the server', async () => {
    renderPage()
    await screen.findAllByText('Katherine Johnson')

    fireEvent.click(screen.getByRole('tab', { name: 'Non-Teaching' }))

    await waitFor(() => {
      expect(apiMock.listStaff).toHaveBeenLastCalledWith(
        expect.objectContaining({ category: 'NON_TEACHING' }),
      )
    })
  })

  it('creates a staff account via the position-based invitation form', async () => {
    renderPage()
    await screen.findAllByText('Katherine Johnson')

    fireEvent.click(screen.getByRole('button', { name: 'Add Staff' }))
    fireEvent.change(screen.getByLabelText(/^First name/), { target: { value: 'Mary' } })
    fireEvent.change(screen.getByLabelText(/^Last name/), { target: { value: 'Jackson' } })
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'mary@school.edu' } })
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: 'TEACHING' } })
    fireEvent.change(screen.getByLabelText(/^Position/), { target: { value: 'CLASS_TEACHER' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create & invite' }))

    expect(await screen.findByRole('heading', { name: 'Invitation sent' })).toBeInTheDocument()
    expect(apiMock.createStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Mary',
        email: 'mary@school.edu',
        position: 'CLASS_TEACHER',
      }),
    )
    expect(JSON.stringify(apiMock.createStaff.mock.calls[0])).not.toContain('password')
    expect(pushMock).toHaveBeenCalledWith(
      'success',
      expect.stringContaining('invitation email has been sent'),
    )
  })

  it('requires a position before creating an account', async () => {
    renderPage()
    await screen.findAllByText('Katherine Johnson')

    fireEvent.click(screen.getByRole('button', { name: 'Add Staff' }))
    fireEvent.change(screen.getByLabelText(/^First name/), { target: { value: 'Mary' } })
    fireEvent.change(screen.getByLabelText(/^Last name/), { target: { value: 'Jackson' } })
    fireEvent.change(screen.getByLabelText(/^Email/), { target: { value: 'mary@school.edu' } })
    fireEvent.change(screen.getByLabelText(/^Category/), { target: { value: 'TEACHING' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create & invite' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Select a staff position.')
    expect(apiMock.createStaff).not.toHaveBeenCalled()
  })

  it('keeps input focus while typing (no field remount)', async () => {
    renderPage()
    await screen.findAllByText('Katherine Johnson')

    fireEvent.click(screen.getByRole('button', { name: 'Add Staff' }))
    const firstName = screen.getByLabelText(/^First name/)
    firstName.focus()

    fireEvent.change(firstName, { target: { value: 'M' } })
    fireEvent.change(firstName, { target: { value: 'Ma' } })
    fireEvent.change(firstName, { target: { value: 'Mary' } })

    expect(firstName).toBe(document.activeElement)
  })

  it('shows an empty state when there are no staff', async () => {
    apiMock.listStaff.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No staff members found yet.')).toBeInTheDocument()
  })
})
