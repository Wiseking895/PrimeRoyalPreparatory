import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SessionsPage } from './SessionsPage'
import type { AcademicSessionView, AcademicTermView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listSessions: vi.fn(),
  listTerms: vi.fn(),
  createSession: vi.fn(),
  updateSession: vi.fn(),
  setSessionStatus: vi.fn(),
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
    updatedAt: '2026-01-01T00:00:00.000Z',
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
    <MemoryRouter initialEntries={['/accountant/sessions']}>
      <SessionsPage />
    </MemoryRouter>,
  )
}

describe('SessionsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    apiMock.listSessions.mockResolvedValue([sessionFixture()])
    apiMock.listTerms.mockResolvedValue([termFixture()])
    apiMock.createSession.mockResolvedValue(sessionFixture({ id: 'session-2', name: '2027/2028 Academic Session' }))
    apiMock.updateSession.mockResolvedValue(sessionFixture({ name: 'Renamed Session' }))
    apiMock.setSessionStatus.mockResolvedValue(sessionFixture({ status: 'INACTIVE' }))
  })

  it('renders sessions and terms for a viewer', async () => {
    PERMISSIONS = ['academic.view']
    renderPage()

    expect((await screen.findAllByText('2026/2027 Academic Session')).length).toBeGreaterThan(0)
    expect(screen.getByText('First Term')).toBeInTheDocument()
    expect(screen.getByText('Total Sessions')).toBeInTheDocument()
    expect(screen.getByText('Total Terms')).toBeInTheDocument()
  })

  it('hides create and manage controls without academic.manage (accountant is view-only)', async () => {
    PERMISSIONS = ['academic.view']
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    expect(screen.queryByRole('button', { name: /Add Session/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add Term/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Deactivate/i })).not.toBeInTheDocument()
  })

  it('shows manage controls and creates a session with academic.manage', async () => {
    PERMISSIONS = ['academic.view', 'academic.manage']
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    fireEvent.click(screen.getByRole('button', { name: /Add Session/i }))

    fireEvent.change(screen.getByLabelText(/^Session name/), { target: { value: '2027/2028 Academic Session' } })
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: '2027-09-01' } })
    fireEvent.change(screen.getByLabelText(/^End date/), { target: { value: '2028-07-31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))

    await waitFor(() => {
      expect(apiMock.createSession).toHaveBeenCalledWith(
        expect.objectContaining({ name: '2027/2028 Academic Session', startDate: '2027-09-01', endDate: '2028-07-31' }),
      )
    })
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('created'))
  })

  it('keeps input focus while typing in the session form', async () => {
    PERMISSIONS = ['academic.view', 'academic.manage']
    renderPage()

    await screen.findAllByText('2026/2027 Academic Session')
    fireEvent.click(screen.getByRole('button', { name: /Add Session/i }))

    const name = screen.getByLabelText(/^Session name/)
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
    fireEvent.click(screen.getByRole('button', { name: /Add Session/i }))

    fireEvent.change(screen.getByLabelText(/^Session name/), { target: { value: 'Bad Session' } })
    fireEvent.change(screen.getByLabelText(/^Start date/), { target: { value: '2027-09-01' } })
    fireEvent.change(screen.getByLabelText(/^End date/), { target: { value: '2027-08-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create session' }))

    expect(await screen.findByText('The end date must be after the start date.')).toBeInTheDocument()
    expect(apiMock.createSession).not.toHaveBeenCalled()
  })

  it('shows an empty state when there are no sessions', async () => {
    PERMISSIONS = ['academic.view']
    apiMock.listSessions.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No academic sessions have been created yet.')).toBeInTheDocument()
  })

  it('deactivates a session via the confirmation dialog', async () => {
    PERMISSIONS = ['academic.view', 'academic.manage']
    renderPage()
    await screen.findAllByText('2026/2027 Academic Session')

    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[0])
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate session' })
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => {
      expect(apiMock.setSessionStatus).toHaveBeenCalledWith('session-1', 'INACTIVE')
    })
  })
})