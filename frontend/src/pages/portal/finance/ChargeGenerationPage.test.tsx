import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ChargeGenerationPage } from './ChargeGenerationPage'
import type { AcademicSessionView, FeeView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listSessions: vi.fn(),
  listFees: vi.fn(),
  generateSessionCharges: vi.fn(),
  generateFeeCharges: vi.fn(),
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
    feeCount: 1,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function feeFixture(overrides: Partial<FeeView> = {}): FeeView {
  return {
    id: 'fee-1',
    sessionId: 'session-1',
    sessionName: '2026/2027 Academic Session',
    name: 'School Fees',
    feeType: 'TERMLY',
    amount: '150000.00',
    description: null,
    status: 'ACTIVE',
    assignmentCount: 10,
    activeAssignmentCount: 8,
    chargeCount: 0,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accountant/charges']}>
      <ChargeGenerationPage />
    </MemoryRouter>,
  )
}

describe('ChargeGenerationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    apiMock.listSessions.mockResolvedValue([sessionFixture()])
    apiMock.listFees.mockResolvedValue([feeFixture()])
    apiMock.generateSessionCharges.mockResolvedValue({ created: 8 })
    apiMock.generateFeeCharges.mockResolvedValue({ created: 8 })
  })

  it('renders fees for the selected session', async () => {
    PERMISSIONS = ['finance.view']
    renderPage()

    expect((await screen.findAllByText('School Fees')).length).toBeGreaterThan(0)
    expect(screen.getByText('Chargeable fees')).toBeInTheDocument()
  })

  it('hides generate controls without fees.manage (view-only roles)', async () => {
    PERMISSIONS = ['finance.view']
    renderPage()

    await screen.findAllByText('School Fees')
    expect(screen.queryByRole('button', { name: /Generate all charges/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Generate$/i })).not.toBeInTheDocument()
  })

  it('generates all charges via the confirmation dialog', async () => {
    PERMISSIONS = ['finance.view', 'fees.manage']
    renderPage()

    await screen.findAllByText('School Fees')
    fireEvent.click(screen.getByRole('button', { name: /Generate all charges/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Generate all charges' })
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Generate charges' }))

    await waitFor(() => {
      expect(apiMock.generateSessionCharges).toHaveBeenCalledWith('session-1')
    })
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('Generated 8 charge(s)'))
  })

  it('generates charges for a single fee via the confirmation dialog', async () => {
    PERMISSIONS = ['finance.view', 'fees.manage']
    renderPage()

    await screen.findAllByText('School Fees')
    fireEvent.click(screen.getByRole('button', { name: /^Generate$/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Generate charges' })
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Generate charges' }))

    await waitFor(() => {
      expect(apiMock.generateFeeCharges).toHaveBeenCalledWith('fee-1')
    })
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('Generated 8 charge(s)'))
  })

  it('shows an empty state when there are no sessions', async () => {
    PERMISSIONS = ['finance.view']
    apiMock.listSessions.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No academic sessions available.')).toBeInTheDocument()
  })
})