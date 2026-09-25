import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FinanceDashboardPage } from './FinanceDashboardPage'
import type { FinanceSummaryView, OwnerFinanceClassRow, OwnerFinanceOverviewView } from '@/types/portal'

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

function overviewFixture(dailyFees: OwnerFinanceClassRow[] = []): OwnerFinanceOverviewView {
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
    dailyFees,
    ptaFees: [],
    maintenanceFees: [],
    paFees: [],
  }
}

const attendanceClassRow: OwnerFinanceClassRow = {
  classId: 'class-1',
  className: 'Primary 6',
  pupilCount: 3,
  expectedAmount: '30.00',
  collectedAmount: '20.00',
  outstandingAmount: '10.00',
  boysPresent: 2,
  boysAbsent: 1,
  girlsPresent: 1,
  girlsAbsent: 1,
}

function tableCellTexts(row: HTMLElement): string[] {
  return Array.from(row.querySelectorAll('td')).map((td) => td.textContent ?? '')
}

function headerTexts(table: HTMLElement): string[] {
  return Array.from(table.querySelectorAll('th')).map((th) => th.textContent ?? '')
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
    expect(screen.getByRole('link', { name: /Fee Structures/i })).toHaveAttribute('href', '/accountant/fees')
    expect(screen.getByRole('link', { name: /Reconciliation/i })).toHaveAttribute('href', '/accountant/reconciliation')
    expect(screen.getByRole('link', { name: /Payment History/i })).toHaveAttribute('href', '/accountant/payments')
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

  it('replaces the Pupils column with the attendance breakdown columns', async () => {
    apiMock.financeOverview.mockResolvedValue(overviewFixture([attendanceClassRow]))
    renderPage()

    const classHeaders = await screen.findAllByText('Boys Present')
    expect(classHeaders.length).toBeGreaterThan(0)
    const table = classHeaders[0].closest('table') as HTMLElement
    expect(headerTexts(table)).toEqual([
      'Class',
      'Boys Present',
      'Boys Absent',
      'Girls Present',
      'Girls Absent',
      'Total Present',
      'Total Absent',
      'Grand Total',
      'Expected',
      'Collected',
      'Outstanding',
    ])
    expect(screen.queryByText('Pupils')).not.toBeInTheDocument()
  })

  it('renders per-row attendance maths for each class', async () => {
    apiMock.financeOverview.mockResolvedValue(overviewFixture([attendanceClassRow]))
    renderPage()

    const classCells = (await screen.findAllByText('Primary 6')).filter((cell) => cell.closest('tr'))
    expect(classCells.length).toBeGreaterThan(0)
    for (const cell of classCells) {
      const row = cell.closest('tr') as HTMLElement
      const cells = tableCellTexts(row)
      expect(cells.slice(0, 8)).toEqual(['Primary 6', '2', '1', '1', '1', '3', '2', '5'])
    }

    const feeTable = classCells[0].closest('table') as HTMLElement
    const feeRow = classCells
      .find((cell) => cell.closest('table') === feeTable)!
      .closest('tr') as HTMLElement
    expect(tableCellTexts(feeRow).slice(8)).toEqual(['30.00', '20.00', '10.00'])
  })

  it('shows a GRAND TOTAL footer summing attendance and finance columns', async () => {
    apiMock.financeOverview.mockResolvedValue(overviewFixture([attendanceClassRow]))
    renderPage()

    const footers = await screen.findAllByText('GRAND TOTAL')
    expect(footers.length).toBeGreaterThan(0)
    for (const footer of footers) {
      const row = footer.closest('tr') as HTMLElement
      const cells = tableCellTexts(row)
      expect(cells.slice(0, 8)).toEqual(['GRAND TOTAL', '2', '1', '1', '1', '3', '2', '5'])
    }

    const feeTableFooter = footers[0].closest('tr') as HTMLElement
    expect(tableCellTexts(feeTableFooter).slice(8)).toEqual([
      '1,500,000.00',
      '500,000.00',
      '1,000,000.00',
    ])
  })
})
