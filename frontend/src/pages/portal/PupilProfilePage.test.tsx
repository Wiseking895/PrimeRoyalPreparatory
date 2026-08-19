import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PupilProfilePage } from './PupilProfilePage'
import type { PupilView, SchoolClassView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  getPupil: vi.fn(),
  listClasses: vi.fn(),
  updatePupil: vi.fn(),
  setPupilStatus: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))

const PUPIL_PERMISSIONS = ['pupils.view', 'pupils.update']

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
    address: 'Accra',
    guardians: [
      {
        id: 'guardian-1',
        fullName: 'Yaw Boateng',
        phone: '+233 20 000 0000',
        email: 'yaw@example.com',
        address: 'Accra',
        relationship: 'Father',
        isPrimary: true,
        isEmergency: true,
      },
    ],
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
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
    <MemoryRouter initialEntries={['/headteacher/pupils/pupil-1']}>
      <Routes>
        <Route path="/headteacher/pupils/:id" element={<PupilProfilePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('PupilProfilePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    apiMock.getPupil.mockResolvedValue(pupilFixture())
    apiMock.listClasses.mockResolvedValue([classFixture()])
    apiMock.updatePupil.mockResolvedValue(pupilFixture({ firstName: 'Ama', lastName: 'Owusu' }))
    apiMock.setPupilStatus.mockResolvedValue(pupilFixture({ status: 'INACTIVE' }))
  })

  it('renders the pupil profile with details', async () => {
    renderPage()

    expect(await screen.findByText('Ama Boateng')).toBeInTheDocument()
    expect(screen.getByText('PRPS-PUP-0001 · Primary 1')).toBeInTheDocument()
    expect(screen.getAllByText('Female').length).toBeGreaterThan(0)
    expect(screen.getAllByText('ADM-2026-001').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Accra').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0)
  })

  it('renders guardian contacts', async () => {
    renderPage()

    expect(await screen.findByText('Yaw Boateng')).toBeInTheDocument()
    expect(screen.getByText('Father')).toBeInTheDocument()
    expect(screen.getByText('+233 20 000 0000')).toBeInTheDocument()
    expect(screen.getAllByText('Primary').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Emergency contact').length).toBeGreaterThan(0)
  })

  it('edits the pupil profile and saves', async () => {
    renderPage()
    await screen.findByText('Ama Boateng')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const lastName = screen.getByLabelText(/^Last name/)
    fireEvent.change(lastName, { target: { value: 'Owusu' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(apiMock.updatePupil).toHaveBeenCalledWith(
        'pupil-1',
        expect.objectContaining({ lastName: 'Owusu' }),
      )
    })
    expect(pushMock).toHaveBeenCalledWith('success', 'Pupil profile updated.')
  })

  it('deactivates the pupil via the confirmation dialog', async () => {
    renderPage()
    await screen.findByText('Ama Boateng')

    fireEvent.click(screen.getByRole('button', { name: 'Deactivate' }))

    const dialog = await screen.findByRole('dialog', { name: 'Deactivate pupil' })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => {
      expect(apiMock.setPupilStatus).toHaveBeenCalledWith('pupil-1', 'INACTIVE')
    })
    expect(pushMock).toHaveBeenCalledWith(
      'success',
      expect.stringContaining('deactivated'),
    )
  })

  it('keeps input focus while typing in the edit form', async () => {
    renderPage()
    await screen.findByText('Ama Boateng')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const firstName = screen.getByLabelText(/^First name/)
    firstName.focus()

    fireEvent.change(firstName, { target: { value: 'A' } })
    fireEvent.change(firstName, { target: { value: 'Am' } })
    fireEvent.change(firstName, { target: { value: 'Amma' } })

    expect(firstName).toBe(document.activeElement)
  })
})