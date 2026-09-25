import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionsPage } from './SessionsPage'
import type { AcademicSessionView, AcademicTermView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listSessions: vi.fn(),
  listTerms: vi.fn(),
  listFees: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  setSessionStatus: vi.fn(),
  createTerm: vi.fn(),
  updateTerm: vi.fn(),
  setTermStatus: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))

let PERMISSIONS: string[] = []

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'acc-1',
      fullName: 'Ada Lovelace',
      email: 'ada@school.edu',
      phone: null,
      profilePictureUrl: null,
      status: 'ACTIVE',
      lastLoginAt: null,
      mustChangePassword: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      staffId: 'PRPS-ACC-001',
      category: 'FINANCE',
      position: null,
      roles: ['ACCOUNTANT'],
      permissions: PERMISSIONS,
    },
    hasPermission: (key: string) => PERMISSIONS.includes(key),
  }),
}))

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('@/components/dashboard/Toast', () => ({
  useToast: () => ({ push: pushMock }),
}))

const createObjectURLMock = vi.fn((_blob: Blob | MediaSource) => 'blob:export')
const revokeObjectURLMock = vi.fn((_url: string) => undefined)
URL.createObjectURL = createObjectURLMock
URL.revokeObjectURL = revokeObjectURLMock

function sessionFixture(overrides: Partial<AcademicSessionView> = {}): AcademicSessionView {
  return {
    id: 'session-1',
    name: '2026/2027 Academic Session',
    startDate: '2026-09-01T00:00:00.000Z',
    endDate: '2027-07-31T00:00:00.000Z',
    status: 'ACTIVE',
    termCount: 1,
    feeCount: 2,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-08-15T00:00:00.000Z',
    ...overrides,
  }
}

function termFixture(overrides: Partial<AcademicTermView> = {}): AcademicTermView {
  return {
    id: 'term-1',
    sessionId: 'session-1',
    name: 'First Term',
    termNumber: 1,
    startDate: '2026-09-01T00:00:00.000Z',
    endDate: '2026-12-18T00:00:00.000Z',
    schoolDays: 80,
    status: 'ACTIVE',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/headteacher/finance/sessions']}>
      <SessionsPage />
    </MemoryRouter>,
  )
}

describe('SessionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    createObjectURLMock.mockClear()
    revokeObjectURLMock.mockClear()
    apiMock.listSessions.mockResolvedValue([sessionFixture()])
    apiMock.listTerms.mockResolvedValue([termFixture()])
    apiMock.listFees.mockResolvedValue([])
    apiMock.createSession.mockResolvedValue(sessionFixture({ id: 'session-2', name: '2027/2028 Academic Session' }))
    apiMock.updateSession.mockResolvedValue(sessionFixture({ name: 'Renamed Session' }))
    apiMock.setSessionStatus.mockResolvedValue(sessionFixture({ status: 'INACTIVE' }))
    apiMock.createTerm.mockResolvedValue(termFixture({ id: 'term-2' }))
    apiMock.updateTerm.mockResolvedValue(termFixture())
    apiMock.setTermStatus.mockResolvedValue(termFixture({ status: 'INACTIVE' }))
  })

  it('renders sessions and terms for a viewer', async () => {
    PERMISSIONS = ['academic.view']
    renderPage()

    expect((await screen.findAllByText('2026/2027 Academic Session')).length).toBeGreaterThan(0)
    expect((await screen.findAllByText('First Term')).length).toBeGreaterThan(0)
    expect(screen.getByText('Academic Years')).toBeInTheDocument()
    expect(screen.getAllByText('1 total / 1 active')).toHaveLength(2)
  })

  it('shows the setup breadcrumb and page subtitle', async () => {
    PERMISSIONS = ['academic.view']
    renderPage()

    const breadcrumb = await screen.findByRole('navigation', { name: 'Breadcrumb' })
    expect(within(breadcrumb).getByText('Setup')).toBeInTheDocument()
    expect(within(breadcrumb).getByText('Academic Years & Terms')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Define the school teaching calendar, manage term dates, and control which academic year is currently active for PRPS.',
      ),
    ).toBeInTheDocument()
  })

  it('hides create and manage controls without academic.manage (accountant is view-only)', async () => {
    PERMISSIONS = ['academic.view']
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    expect(screen.queryByRole('button', { name: /Add Academic Year/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add Term/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Deactivate/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Restore/i })).not.toBeInTheDocument()
  })

  it('shows manage controls and creates a session with academic.manage', async () => {
    PERMISSIONS = ['academic.view', 'academic.manage']
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    fireEvent.click(screen.getByRole('button', { name: /Add Academic Year/i }))

    fireEvent.change(screen.getByLabelText(/^Academic year name/), { target: { value: '2027/2028 Academic Session' } })
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: '2027-09-01' } })
    fireEvent.change(screen.getByLabelText(/^End date/), { target: { value: '2028-07-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create academic year' }))

    await waitFor(() => {
      expect(apiMock.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ name: '2027/2028 Academic Session', startDate: '2027-09-01', endDate: '2028-07-31' }),
      )
    })
    expect(apiMock.createTerm).not.toHaveBeenCalled()
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('created'))
  })

  it('creates an academic year together with configured term dates', async () => {
    PERMISSIONS = ['academic.view', 'academic.manage']
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    fireEvent.click(screen.getByRole('button', { name: /Add Academic Year/i }))

    fireEvent.change(screen.getByLabelText(/^Academic year name/), { target: { value: '2027/2028' } })
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: '2027-09-01' } })
    fireEvent.change(screen.getByLabelText(/^End date/), { target: { value: '2028-07-31' } })
    fireEvent.change(screen.getByLabelText('First Term start date'), { target: { value: '2027-09-01' } })
    fireEvent.change(screen.getByLabelText('First Term end date'), { target: { value: '2027-12-15' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create academic year' }))

    await waitFor(() => {
      expect(apiMock.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ name: '2027/2028', startDate: '2027-09-01', endDate: '2028-07-31' }),
      )
    })
    await waitFor(() => {
      expect(apiMock.createTerm).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'First Term',
          termNumber: 1,
          startDate: '2027-09-01',
          endDate: '2027-12-15',
        }),
      )
    })
  })

  it('keeps input focus while typing in the session form', async () => {
    PERMISSIONS = ['academic.view', 'academic.manage']
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    fireEvent.click(screen.getByRole('button', { name: /Add Academic Year/i }))

    const name = screen.getByLabelText(/^Academic year name/)
    name.focus()
    fireEvent.change(name, { target: { value: '20' } })
    fireEvent.change(name, { target: { value: '2027' } })
    fireEvent.change(name, { target: { value: '2027/2028 Academic Session' } })

    expect(name).toBe(document.activeElement)
  })

  it('shows validation errors for invalid session dates', async () => {
    PERMISSIONS = ['academic.view', 'academic.manage']
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    fireEvent.click(screen.getByRole('button', { name: /Add Academic Year/i }))

    fireEvent.change(screen.getByLabelText(/^Academic year name/), { target: { value: 'Bad Session' } })
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: '2027-09-01' } })
    fireEvent.change(screen.getByLabelText(/^End date/), { target: { value: '2027-08-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create academic year' }))

    expect(await screen.findByText('The end date must be after the start date.')).toBeInTheDocument()
    expect(apiMock.createSession).not.toHaveBeenCalled()
  })

  it('rejects term dates that end before they start inside the academic year workflow', async () => {
    PERMISSIONS = ['academic.view', 'academic.manage']
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    fireEvent.click(screen.getByRole('button', { name: /Add Academic Year/i }))

    fireEvent.change(screen.getByLabelText(/^Academic year name/), { target: { value: '2027/2028' } })
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: '2027-09-01' } })
    fireEvent.change(screen.getByLabelText(/^End date/), { target: { value: '2028-07-31' } })
    fireEvent.change(screen.getByLabelText('First Term start date'), { target: { value: '2027-12-15' } })
    fireEvent.change(screen.getByLabelText('First Term end date'), { target: { value: '2027-09-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create academic year' }))

    expect(await screen.findByText('First Term must end after it starts.')).toBeInTheDocument()
    expect(apiMock.createSession).not.toHaveBeenCalled()
  })

  it('shows an empty state when there are no sessions', async () => {
    PERMISSIONS = ['academic.view']
    apiMock.listSessions.mockResolvedValue([])
    renderPage()

    expect(
      await screen.findByText('No academic years have been configured yet.'),
    ).toBeInTheDocument()
  })

  it('shows a contextual warning banner describing the real impact of changing the active year', async () => {
    PERMISSIONS = ['academic.view']
    renderPage()

    expect(
      await screen.findByText(
        'Changing the active academic year affects admissions, charge generation, and payments.',
      ),
    ).toBeInTheDocument()
  })

  it('shows real pagination values for the loaded dataset', async () => {
    PERMISSIONS = ['academic.view']
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    expect(screen.getByText('Showing 1 of 1 academic years')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Previous/i })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Next/i })).toBeDisabled()
  })

  it('filters academic years with the search box', async () => {
    PERMISSIONS = ['academic.view']
    apiMock.listSessions.mockResolvedValue([
      sessionFixture(),
      sessionFixture({
        id: 'session-0',
        name: '2025/2026 Academic Session',
        startDate: '2025-09-01T00:00:00.000Z',
        endDate: '2026-07-31T00:00:00.000Z',
        status: 'INACTIVE',
      }),
    ])
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    fireEvent.change(screen.getByLabelText('Search'), { target: { value: '2025' } })

    expect((await screen.findAllByText('2025/2026 Academic Session')).length).toBeGreaterThan(0)
    const table = screen.getAllByRole('table')[0]
    expect(within(table).queryByText('2026/2027 Academic Session')).not.toBeInTheDocument()
    expect(screen.getByText('Showing 1 of 1 academic years')).toBeInTheDocument()
  })

  it('filters academic years by status', async () => {
    PERMISSIONS = ['academic.view']
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'INACTIVE' } })

    expect(await screen.findByText('No academic years match your filters.')).toBeInTheDocument()
    expect(screen.queryByText('Showing 1 of 1 academic years')).not.toBeInTheDocument()
  })

  it('sorts academic years newest first by start date', async () => {
    PERMISSIONS = ['academic.view']
    apiMock.listSessions.mockResolvedValue([
      sessionFixture({
        id: 'session-0',
        name: '2025/2026 Academic Session',
        startDate: '2025-09-01T00:00:00.000Z',
        endDate: '2026-07-31T00:00:00.000Z',
        status: 'INACTIVE',
      }),
      sessionFixture(),
    ])
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    const table = screen.getAllByRole('table')[0]
    const rows = within(table).getAllByRole('row').slice(1)
    expect(within(rows[0]).getByText('2026/2027 Academic Session')).toBeInTheDocument()
    expect(within(rows[1]).getByText('2025/2026 Academic Session')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Sort'), { target: { value: 'oldest' } })
    const sortedRows = within(table).getAllByRole('row').slice(1)
    expect(within(sortedRows[0]).getByText('2025/2026 Academic Session')).toBeInTheDocument()
    expect(within(sortedRows[1]).getByText('2026/2027 Academic Session')).toBeInTheDocument()
  })

  it('exports the visible academic year data to CSV', async () => {
    PERMISSIONS = ['academic.view']
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    expect(createObjectURLMock).toHaveBeenCalledTimes(1)
    expect(createObjectURLMock.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(revokeObjectURLMock).toHaveBeenCalledTimes(1)
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('Exported'))
  })

  it('deactivates a session via the confirmation dialog', async () => {
    PERMISSIONS = ['academic.view', 'academic.manage']
    renderPage()
    await screen.findAllByText('2026/2027 Academic Session')

    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[0])
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate academic year' })
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => {
      expect(apiMock.setSessionStatus).toHaveBeenCalledWith('session-1', 'INACTIVE')
    })
  })

  it('restores an archived academic year through the backend', async () => {
    PERMISSIONS = ['academic.view', 'academic.manage']
    apiMock.listSessions.mockResolvedValue([sessionFixture({ status: 'INACTIVE' })])
    renderPage()
    await screen.findAllByText('2026/2027 Academic Session')
    apiMock.setSessionStatus.mockResolvedValue(sessionFixture({ status: 'ACTIVE' }))

    fireEvent.click(screen.getAllByRole('button', { name: 'Restore' })[0])
    const dialog = await screen.findByRole('dialog', { name: 'Activate academic year' })
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Activate' }))

    await waitFor(() => {
      expect(apiMock.setSessionStatus).toHaveBeenCalledWith('session-1', 'ACTIVE')
    })
  })

  it('marks the active academic year as Current', async () => {
    PERMISSIONS = ['academic.view']
    renderPage()

    expect((await screen.findAllByText('Current')).length).toBeGreaterThan(0)
    expect(screen.getByText(/First Term · ends/)).toBeInTheDocument()
    expect(
      screen.getByPlaceholderText('Filter by academic year or code...'),
    ).toBeInTheDocument()
  })

  it('names the screen for academic years rather than sessions', async () => {
    PERMISSIONS = ['academic.view']
    renderPage()

    expect((await screen.findAllByText('Academic Years & Terms')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('1 total / 1 active')).toHaveLength(2)
    expect(screen.queryByText('Sessions & Terms')).not.toBeInTheDocument()
  })

  it('blocks a term that overlaps an existing term in the same academic year', async () => {
    PERMISSIONS = ['academic.view', 'academic.manage']
    renderPage()
    await screen.findAllByText('2026/2027 Academic Session')

    fireEvent.click(screen.getAllByRole('button', { name: 'Add term' })[0])
    fireEvent.change(screen.getByLabelText(/^Term name/), { target: { value: 'Second Term' } })
    fireEvent.change(screen.getByLabelText(/^Term number/), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: '2026-11-01' } })
    fireEvent.change(screen.getByLabelText(/^End date/), { target: { value: '2026-12-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create term' }))

    expect(
      await screen.findByText('This term overlaps another term in the same academic year.'),
    ).toBeInTheDocument()
    expect(apiMock.createTerm).not.toHaveBeenCalled()
  })
})
