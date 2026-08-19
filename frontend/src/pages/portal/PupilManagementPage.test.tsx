import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PupilManagementPage } from './PupilManagementPage'
import type { PupilStats, PupilView, SchoolClassView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listPupils: vi.fn(),
  pupilStats: vi.fn(),
  listClasses: vi.fn(),
  createPupil: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))

const PUPIL_PERMISSIONS = ['pupils.view', 'pupils.create', 'pupils.update']

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
      permissions: PUPIL_PERMISSIONS,
    },
    hasPermission: (key: string) => PUPIL_PERMISSIONS.includes(key),
  }),
}))

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('@/components/dashboard/Toast', () => ({
  useToast: () => ({ push: pushMock }),
}))

function pupilFixture(overrides: Partial<PupilView> = {}): PupilView {
  return {
    id: 'pupil-1',
    pupilId: 'PRPS-PUP-0001',
    admissionNumber: 'ADM-2026-001',
    firstName: 'Ama',
    middleName: null,
    lastName: 'Boateng',
    fullName: 'Ama Boateng',
    dateOfBirth: '2019-05-01T00:00:00.000Z',
    gender: 'FEMALE',
    profilePictureUrl: null,
    classId: 'class-1',
    className: 'Primary 1',
    dateAdmitted: '2026-01-15T00:00:00.000Z',
    status: 'ACTIVE',
    address: null,
    guardians: [],
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  }
}

function statsFixture(): PupilStats {
  return {
    total: 1,
    active: 1,
    inactive: 0,
    byClass: [{ classId: 'class-1', className: 'Primary 1', count: 1 }],
  }
}

function classFixture(overrides: Partial<SchoolClassView> = {}): SchoolClassView {
  return {
    id: 'class-1',
    key: 'PRIMARY_1',
    name: 'Primary 1',
    description: null,
    sortOrder: 0,
    status: 'ACTIVE',
    pupilCount: 1,
    activePupilCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/headteacher/pupils']}>
      <PupilManagementPage />
    </MemoryRouter>,
  )
}

describe('PupilManagementPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    apiMock.listPupils.mockResolvedValue({
      items: [pupilFixture()],
      total: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
    })
    apiMock.pupilStats.mockResolvedValue(statsFixture())
    apiMock.listClasses.mockResolvedValue([classFixture()])
    apiMock.createPupil.mockResolvedValue(pupilFixture())
  })

  it('renders the pupil list', async () => {
    renderPage()

    expect(await screen.findAllByText('Ama Boateng')).toBeTruthy()
    expect(screen.getByText('PRPS-PUP-0001')).toBeInTheDocument()
    expect(screen.getAllByText('Primary 1').length).toBeGreaterThan(0)
    expect(screen.getByText('ADM-2026-001')).toBeInTheDocument()
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
  })

  it('shows the pupil statistics cards', async () => {
    renderPage()

    expect(await screen.findByText('Total Pupils')).toBeInTheDocument()
    expect(screen.getByText('Active Pupils')).toBeInTheDocument()
    expect(screen.getByText('Inactive Pupils')).toBeInTheDocument()
    expect(screen.getAllByText('1').length).toBeGreaterThan(0)
  })

  it('searches pupils by query after the debounce', async () => {
    renderPage()
    await screen.findAllByText('Ama Boateng')

    fireEvent.change(screen.getByLabelText('Search pupils'), { target: { value: 'Boateng' } })

    await waitFor(() => {
      expect(apiMock.listPupils).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: 'Boateng', page: 1 }),
      )
    })
  })

  it('filters by class and status on the server', async () => {
    renderPage()
    await screen.findAllByText('Ama Boateng')

    fireEvent.change(screen.getByLabelText('Filter by class'), { target: { value: 'class-1' } })
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: 'ACTIVE' } })

    await waitFor(() => {
      expect(apiMock.listPupils).toHaveBeenLastCalledWith(
        expect.objectContaining({ classId: 'class-1', status: 'ACTIVE' }),
      )
    })
  })

  it('registers a pupil with guardian contacts', async () => {
    renderPage()
    await screen.findAllByText('Ama Boateng')

    fireEvent.click(screen.getByRole('button', { name: 'Register Pupil' }))
    fireEvent.change(screen.getByLabelText(/^First name/), { target: { value: 'Kojo' } })
    fireEvent.change(screen.getByLabelText(/^Last name/), { target: { value: 'Mensah' } })
    fireEvent.change(screen.getByLabelText(/^Date of birth/), { target: { value: '2018-03-10' } })
    fireEvent.change(screen.getByLabelText(/^Gender/), { target: { value: 'MALE' } })
    fireEvent.change(screen.getByLabelText(/^Class/), { target: { value: 'class-1' } })
    fireEvent.change(screen.getByLabelText(/^Full name/), { target: { value: 'Yaw Mensah' } })
    fireEvent.change(screen.getByLabelText(/^Relationship/), { target: { value: 'Parent' } })
    fireEvent.click(screen.getByRole('button', { name: 'Register pupil' }))

    await waitFor(() => {
      expect(apiMock.createPupil).toHaveBeenCalled()
    })
    expect(apiMock.createPupil).toHaveBeenCalledWith(
      expect.objectContaining({
        firstName: 'Kojo',
        lastName: 'Mensah',
        gender: 'MALE',
        classId: 'class-1',
        guardians: [
          expect.objectContaining({
            fullName: 'Yaw Mensah',
            relationship: 'Parent',
          }),
        ],
      }),
    )
    expect(JSON.stringify(apiMock.createPupil.mock.calls[0])).not.toContain('password')
    expect(pushMock).toHaveBeenCalledWith(
      'success',
      expect.stringContaining('registered successfully'),
    )
  })

  it('requires a class before registering a pupil', async () => {
    renderPage()
    await screen.findAllByText('Ama Boateng')

    fireEvent.click(screen.getByRole('button', { name: 'Register Pupil' }))
    fireEvent.change(screen.getByLabelText(/^First name/), { target: { value: 'Kojo' } })
    fireEvent.change(screen.getByLabelText(/^Last name/), { target: { value: 'Mensah' } })
    fireEvent.change(screen.getByLabelText(/^Date of birth/), { target: { value: '2018-03-10' } })
    fireEvent.change(screen.getByLabelText(/^Gender/), { target: { value: 'MALE' } })
    fireEvent.click(screen.getByRole('button', { name: 'Register pupil' }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts.some((alert) => alert.textContent === 'Select a class.')).toBe(true)
    expect(apiMock.createPupil).not.toHaveBeenCalled()
  })

  it('keeps input focus while typing (no field remount)', async () => {
    renderPage()
    await screen.findAllByText('Ama Boateng')

    fireEvent.click(screen.getByRole('button', { name: 'Register Pupil' }))
    const firstName = screen.getByLabelText(/^First name/)
    firstName.focus()

    fireEvent.change(firstName, { target: { value: 'K' } })
    fireEvent.change(firstName, { target: { value: 'Ko' } })
    fireEvent.change(firstName, { target: { value: 'Kojo' } })

    expect(firstName).toBe(document.activeElement)
  })

  it('shows an empty state when there are no pupils', async () => {
    apiMock.listPupils.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, hasMore: false })
    renderPage()

    expect(await screen.findByText('No pupils registered yet.')).toBeInTheDocument()
  })
})