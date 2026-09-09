import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FinanceDashboardPage } from './FinanceDashboardPage'
import type { FinanceSummaryView, OwnerFinanceOverviewView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  financeSummary: vi.fn(),
  financeOverview: vi.fn(),
  ensureCharges: vi.fn().mockResolvedValue({ feesProcessed: 0, chargesCreated: 0 }),
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

function summaryFixture(overrides: Partial<FinanceSummaryView> = {}): FinanceSummaryView {
  return {
    session: {
      id: 'session-1',
      name: '2026/2027 Academic Session',
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2027-07-31T00:00:00.000Z',
      status: 'ACTIVE',
      termCount: 1,
      feeCount: 2,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    term: {
      id: 'term-1',
      sessionId: 'session-1',
      name: 'First Term',
      termNumber: 1,
      startDate: '2026-09-01T00:00:00.000Z',
      endDate: '2026-12-18T00:00:00.000Z',
      schoolDays: 80,
      status: 'ACTIVE',
    },
    expectedFees: '1500000.00',
    collected: '500000.00',
    outstanding: '1000000.00',
    pupilsWithOutstanding: 12,
    paymentsThisTerm: '200000.00',
    paymentsThisTermCount: 4,
    feeSummary: { total: 2, active: 1, byType: { TERMLY: 1, DAILY: 1, OTHER: 0, PA: 0 } },
    recentPayments: [
      {
        id: 'payment-1',
        paymentReference: 'PAY-2026-0001',
        pupilId: 'pupil-1',
        pupilCode: 'PRPS-P-0001',
        pupilName: 'Ama Mensah',
        amountPaid: '50000.00',
        paymentMethod: 'CASH',
        paymentDate: '2026-08-01T00:00:00.000Z',
        note: null,
        receivedById: 'acc-1',
        receivedByName: 'Ada Lovelace',
        status: 'ACTIVE',
        voidedAt: null,
        voidedById: null,
        voidReason: null,
        allocations: [],
        createdAt: '2026-08-01T00:00:00.000Z',
      },
    ],
    ...overrides,
  }
}

function overviewFixture(): OwnerFinanceOverviewView {
  return {
    session: { id: 'session-1', name: '2026/2027 Academic Session' },
    term: { id: 'term-1', name: 'First Term' },
    totals: {
      totalExpected: '1500000.00',
      totalCollected: '500000.00',
      totalOutstanding: '1000000.00',
      totalPupils: 150,
      pupilsWithCharges: 120,
      pupilsWithPayments: 80,
    },
    dailyFees: [],
    ptaFees: [],
    maintenanceFees: [],
    paFees: [],
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accountant/finance/dashboard']}>
      <FinanceDashboardPage />
    </MemoryRouter>,
  )
}

describe('FinanceDashboardPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    PERMISSIONS = ['finance.view']
    apiMock.financeSummary.mockResolvedValue(summaryFixture())
    apiMock.financeOverview.mockResolvedValue(overviewFixture())
  })

  it('renders the finance overview stats', async () => {
    renderPage()

    expect(await screen.findByText('Total Expected')).toBeInTheDocument()
    expect(screen.getByText('Total Collected')).toBeInTheDocument()
    expect(screen.getByText('Outstanding')).toBeInTheDocument()
    expect(screen.getByText('Active Classes')).toBeInTheDocument()
  })

  it('shows finance overview without academic period card', async () => {
    renderPage()

    expect(await screen.findByText('Total Expected')).toBeInTheDocument()
    expect(screen.getByText('Total Collected')).toBeInTheDocument()
    expect(screen.getByText('Outstanding')).toBeInTheDocument()
  })

  it('shows a recent payment', async () => {
    renderPage()

    expect(await screen.findByText(/Ama Mensah — 50,000.00/)).toBeInTheDocument()
    expect(screen.getByText(/PAY-2026-0001/)).toBeInTheDocument()
  })

  it('shows quick action links pointing at the finance module', async () => {
    renderPage()

    expect(await screen.findByText('Quick Actions')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Record Payment/i })).toHaveAttribute('href', '/accountant/payments')
    expect(screen.getByRole('link', { name: /Pupil Finance/i })).toHaveAttribute('href', '/accountant/pupils')
  })

  it('shows fee category toggle buttons', async () => {
    renderPage()

    expect(await screen.findByText('Total Expected')).toBeInTheDocument()
    expect(screen.getByText('Daily Fees')).toBeInTheDocument()
    expect(screen.getByText('PTA Fees')).toBeInTheDocument()
    expect(screen.getByText('Maintenance Fees')).toBeInTheDocument()
  })

  it('shows finance summary data without academic period card', async () => {
    renderPage()

    expect(await screen.findByText('Total Expected')).toBeInTheDocument()
    expect(screen.getByText('Outstanding Arrears')).toBeInTheDocument()
  })

  it('shows outstanding arrears section', async () => {
    renderPage()

    expect(await screen.findByText('Total Expected')).toBeInTheDocument()
    expect(screen.getByText('Outstanding Arrears')).toBeInTheDocument()
  })
})
