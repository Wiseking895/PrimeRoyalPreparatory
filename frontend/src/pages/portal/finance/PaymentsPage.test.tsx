import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentsPage } from './PaymentsPage'
import type { AcademicSessionView, AcademicTermView, FinanceSummaryView, PaymentListResult, PaymentView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listPayments: vi.fn(),
  financeSummary: vi.fn(),
  listSessions: vi.fn(),
  listTerms: vi.fn(),
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

function paymentFixture(overrides: Partial<PaymentView> = {}): PaymentView {
  return {
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
    allocations: [
      { id: 'alloc-1', chargeId: 'charge-1', feeName: 'School Fees', termName: 'First Term', amount: '50000.00' },
    ],
    createdAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
}

function resultFixture(overrides: Partial<PaymentListResult> = {}): PaymentListResult {
  return {
    items: [paymentFixture()],
    total: 1,
    page: 1,
    pageSize: 20,
    hasMore: false,
    ...overrides,
  }
}

const sessionFixture: AcademicSessionView = {
  id: 'session-1',
  name: '2026/2027',
  startDate: '2026-09-01',
  endDate: '2027-07-31',
  status: 'ACTIVE',
  termCount: 3,
  feeCount: 4,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const session2Fixture: AcademicSessionView = {
  id: 'session-2',
  name: '2027/2028',
  startDate: '2027-09-01',
  endDate: '2028-07-31',
  status: 'ACTIVE',
  termCount: 3,
  feeCount: 0,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const term1Fixture: AcademicTermView = {
  id: 'term-1',
  sessionId: 'session-1',
  name: 'First Term',
  termNumber: 1,
  startDate: '2026-09-01',
  endDate: '2026-12-18',
  schoolDays: 79,
  status: 'ACTIVE',
}

const term2Fixture: AcademicTermView = {
  id: 'term-2',
  sessionId: 'session-1',
  name: 'Second Term',
  termNumber: 2,
  startDate: '2027-01-06',
  endDate: '2027-04-02',
  schoolDays: 63,
  status: 'INACTIVE',
}

const term3Fixture: AcademicTermView = {
  id: 'term-3',
  sessionId: 'session-2',
  name: 'First Term',
  termNumber: 1,
  startDate: '2027-09-01',
  endDate: '2027-12-17',
  schoolDays: 80,
  status: 'ACTIVE',
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accountant/payments']}>
      <PaymentsPage />
    </MemoryRouter>,
  )
}

describe('PaymentsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.listPayments.mockResolvedValue(resultFixture())
    apiMock.listSessions.mockResolvedValue([sessionFixture, session2Fixture])
    apiMock.financeSummary.mockResolvedValue({
      session: sessionFixture,
      term: term1Fixture,
    } as unknown as FinanceSummaryView)
    apiMock.listTerms.mockImplementation(async (sessionId?: string) =>
      sessionId === 'session-2' ? [term3Fixture] : [term1Fixture, term2Fixture],
    )
  })

  it('renders the payments list', async () => {
    PERMISSIONS = ['finance.view']
    renderPage()

    expect((await screen.findAllByText('PAY-2026-0001')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50,000.00').length).toBeGreaterThan(0)
  })

  it('is read-only: shows no payment-creation actions even with payments.record', async () => {
    PERMISSIONS = ['finance.view', 'payments.record']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    expect(screen.queryByRole('button', { name: /Record payment/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Add Payment/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /New Payment/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Create Payment/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Make Payment/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText(/Record a payment/i)).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no payments', async () => {
    PERMISSIONS = ['finance.view']
    apiMock.listPayments.mockResolvedValue(resultFixture({ items: [], total: 0 }))
    renderPage()

    expect(await screen.findByText('No payments found.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Record payment/i })).not.toBeInTheDocument()
    expect(screen.getByText('No payment transactions were recorded in this period.')).toBeInTheDocument()
  })

  it('titles the page Payment History with session and term context', async () => {
    PERMISSIONS = ['finance.view']
    renderPage()

    expect(await screen.findByRole('heading', { name: 'Payment History' })).toBeInTheDocument()
    expect(
      await screen.findByText(/Read-only historical payment transactions/),
    ).toBeInTheDocument()
    expect(await screen.findByText('2026/2027 — First Term')).toBeInTheDocument()
  })

  it('loads only the first 7 school days of the term initially', async () => {
    PERMISSIONS = ['finance.view']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    expect(apiMock.listPayments).toHaveBeenLastCalledWith(
      expect.objectContaining({
        from: '2026-09-01T00:00:00.000Z',
        to: '2026-09-09T23:59:59.999Z',
        page: 1,
        pageSize: 20,
      }),
    )
    expect(screen.getByText(/School Days 1–7 of 79/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous 7 school days' })).toBeDisabled()
  })

  it('navigates to the next 7 school days window', async () => {
    PERMISSIONS = ['finance.view']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    fireEvent.click(screen.getByRole('button', { name: 'Next 7 school days' }))

    await waitFor(() => {
      expect(apiMock.listPayments).toHaveBeenLastCalledWith(
        expect.objectContaining({
          from: '2026-09-10T00:00:00.000Z',
          to: '2026-09-18T23:59:59.999Z',
        }),
      )
    })
    expect(screen.getByText(/School Days 8–14 of 79/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Previous 7 school days' })).toBeEnabled()
  })

  it('filters history to the selected term range', async () => {
    PERMISSIONS = ['finance.view']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    fireEvent.change(screen.getByLabelText('Term'), { target: { value: 'term-2' } })

    await waitFor(() => {
      expect(apiMock.listPayments).toHaveBeenLastCalledWith(
        expect.objectContaining({
          from: '2027-01-06T00:00:00.000Z',
          to: '2027-01-14T23:59:59.999Z',
        }),
      )
    })
    expect(await screen.findByText('2026/2027 — Second Term')).toBeInTheDocument()
    expect(screen.getByText(/School Days 1–7 of 63/)).toBeInTheDocument()
  })

  it('switches history when the session changes', async () => {
    PERMISSIONS = ['finance.view']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    fireEvent.change(screen.getByLabelText('Academic Year'), { target: { value: 'session-2' } })

    await waitFor(() => {
      expect(apiMock.listTerms).toHaveBeenCalledWith('session-2')
      expect(apiMock.listPayments).toHaveBeenLastCalledWith(
        expect.objectContaining({
          from: '2027-09-01T00:00:00.000Z',
          to: '2027-09-09T23:59:59.999Z',
        }),
      )
    })
    expect(await screen.findByText('2027/2028 — First Term')).toBeInTheDocument()
  })
})
