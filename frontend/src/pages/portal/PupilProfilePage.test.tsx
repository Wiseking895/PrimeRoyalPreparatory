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
  fetchAdmissionFormPdf: vi.fn(),
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
    sheetNumber: '4',
    admissionFee: '150.00',
    firstName: 'Ama',
    middleName: null,
    lastName: 'Boateng',
    fullName: 'Ama Boateng',
    dateOfBirth: '2019-05-01T00:00:00.000Z',
    gender: 'FEMALE',
    profilePictureUrl: null,
    nationality: 'Ghanaian',
    religion: 'Christianity',
    admissionReason: 'Good reputation of the school',
    declarationAcknowledged: true,
    classId: 'class-1',
    className: 'Primary 1',
    dateAdmitted: '2026-01-15T00:00:00.000Z',
    status: 'ACTIVE',
    address: 'Accra',
    previousSchool: 'Sunrise Academy',
    stayWithChild: 'Mother',
    guardians: [
      {
        id: 'guardian-1',
        fullName: 'Yaw Boateng',
        phone: '+233 20 000 0000',
        email: 'yaw@example.com',
        address: 'Accra',
        relationship: 'Father',
        occupation: 'Engineer',
        isPrimary: true,
        isEmergency: true,
      },
    ],
    uniforms: [
      { slot: 1, label: 'Item 1', status: 'COLLECTED' },
      { slot: 2, label: null, status: 'NOT_COLLECTED' },
      { slot: 3, label: null, status: 'NOT_COLLECTED' },
      { slot: 4, label: null, status: 'NOT_COLLECTED' },
      { slot: 5, label: null, status: 'NOT_COLLECTED' },
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

  it('renders admission details and uniform collection status', async () => {
    renderPage()

    expect(await screen.findByText('Ama Boateng')).toBeInTheDocument()
    expect(screen.getByText('Sheet no.')).toBeInTheDocument()
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('GH₵ 150.00')).toBeInTheDocument()
    expect(screen.getByText('Uniforms to be Collected')).toBeInTheDocument()
    expect(screen.getByText('Main Uniform')).toBeInTheDocument()
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('School attended')).toBeInTheDocument()
    expect(screen.getByText('Sunrise Academy')).toBeInTheDocument()
    expect(screen.getByText('Stay with the child')).toBeInTheDocument()
    expect(screen.getByText('Mother')).toBeInTheDocument()
    expect(screen.getByText('Collected')).toBeInTheDocument()
    expect(screen.getAllByText('Not collected').length).toBe(4)
  })

  it('edits admission details and uniform collection status and saves', async () => {
    renderPage()
    await screen.findByText('Ama Boateng')

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText(/^Sheet number/), { target: { value: '9' } })
    fireEvent.change(screen.getByLabelText(/^Admission fee/), { target: { value: '300.25' } })
    fireEvent.change(screen.getByLabelText(/^School attended/), {
      target: { value: 'Melling Primary' },
    })
    fireEvent.change(screen.getAllByLabelText('Collection status')[1], {
      target: { value: 'COLLECTED' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => {
      expect(apiMock.updatePupil).toHaveBeenCalledWith(
        'pupil-1',
        expect.objectContaining({
          sheetNumber: '9',
          admissionFee: '300.25',
          previousSchool: 'Melling Primary',
          uniforms: [
            { slot: 1, label: 'Item 1', status: 'COLLECTED' },
            { slot: 2, label: null, status: 'COLLECTED' },
            { slot: 3, label: null, status: 'NOT_COLLECTED' },
            { slot: 4, label: null, status: 'NOT_COLLECTED' },
            { slot: 5, label: null, status: 'NOT_COLLECTED' },
          ],
        }),
      )
    })
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

  it('offers admission form download and print actions', async () => {
    renderPage()
    await screen.findByText('Ama Boateng')

    expect(screen.getByRole('button', { name: 'Download Admission Form (PDF)' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Print Admission Form' })).toBeInTheDocument()
  })

  it('downloads the admission form with the public filename', async () => {
    const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' })
    apiMock.fetchAdmissionFormPdf.mockResolvedValue(blob)
    const createObjectURL = vi.fn(() => 'blob:admission-form')
    const revokeObjectURL = vi.fn()
    URL.createObjectURL = createObjectURL
    URL.revokeObjectURL = revokeObjectURL
    let downloadedName = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedName = this.download
    })
    const openSpy = vi.spyOn(window, 'open')

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Download Admission Form (PDF)' }))

    await waitFor(() => expect(apiMock.fetchAdmissionFormPdf).toHaveBeenCalledWith('pupil-1'))
    expect(createObjectURL).toHaveBeenCalledWith(blob)
    expect(downloadedName).toBe('PRPS-Admission-Form-ADM-2026-001.pdf')
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:admission-form')
    expect(openSpy).not.toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith('success', 'Admission form downloaded.')
  })

  it('falls back to the pupil id for the download filename', async () => {
    apiMock.getPupil.mockResolvedValue(pupilFixture({ admissionNumber: null }))
    apiMock.fetchAdmissionFormPdf.mockResolvedValue(new Blob(['%PDF-1.7'], { type: 'application/pdf' }))
    URL.createObjectURL = vi.fn(() => 'blob:admission-form')
    URL.revokeObjectURL = vi.fn()
    let downloadedName = ''
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      downloadedName = this.download
    })

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Download Admission Form (PDF)' }))

    await waitFor(() => expect(apiMock.fetchAdmissionFormPdf).toHaveBeenCalledWith('pupil-1'))
    expect(downloadedName).toBe('PRPS-Admission-Form-PRPS-PUP-0001.pdf')
  })

  it('opens only the admission form PDF in a print window', async () => {
    apiMock.fetchAdmissionFormPdf.mockResolvedValue(
      new Blob(['%PDF-1.7'], { type: 'application/pdf' }),
    )
    URL.createObjectURL = vi.fn(() => 'blob:admission-form')
    URL.revokeObjectURL = vi.fn()
    const openSpy = vi.spyOn(window, 'open').mockReturnValue({} as Window)
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Print Admission Form' }))

    await waitFor(() => expect(openSpy).toHaveBeenCalledWith('blob:admission-form', '_blank'))
    expect(apiMock.fetchAdmissionFormPdf).toHaveBeenCalledWith('pupil-1')
    expect(printSpy).not.toHaveBeenCalled()
  })

  it('surfaces an error when the admission form cannot be fetched', async () => {
    apiMock.fetchAdmissionFormPdf.mockRejectedValue(new Error('Could not download the admission form.'))

    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'Download Admission Form (PDF)' }))

    await waitFor(() =>
      expect(pushMock).toHaveBeenCalledWith('error', 'Could not download the admission form.'),
    )
  })
})