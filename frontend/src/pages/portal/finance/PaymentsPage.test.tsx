import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentsPage } from './PaymentsPage'
import type { FeeView, PaymentListResult, PaymentView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listPayments: vi.fn(),
  listFinancePupils: vi.fn(),
  createPayment: vi.fn(),
  markPaid: vi.fn(),
  listFees: vi.fn(),
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

function feeFixture(overrides: Partial<FeeView> = {}): FeeView {
  return {
    id: 'fee-1',
    sessionId: 'session-1',
    sessionName: '2026/2027',
    termId: 'term-1',
    termName: 'First Term',
    name: 'Daily Fee',
    feeType: 'DAILY',
    amount: '10.00',
    description: 'Daily school fee',
    status: 'ACTIVE',
    assignmentCount: 50,
    activeAssignmentCount: 48,
    chargeCount: 50,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
    ...overrides,
  }
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
    pushMock.mockReset()
    apiMock.listPayments.mockResolvedValue(resultFixture())
    apiMock.listFinancePupils.mockResolvedValue({
      items: [
        {
          id: 'pupil-1',
          pupilId: 'PRPS-P-0001',
          fullName: 'Ama Mensah',
          className: 'Primary 1',
          status: 'ACTIVE',
          totalDue: '150000.00',
          totalPaid: '50000.00',
          outstanding: '100000.00',
          chargeCount: 1,
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      hasMore: false,
    })
    apiMock.markPaid.mockResolvedValue(paymentFixture({ paymentReference: 'PAY-2026-0002' }))
    apiMock.listFees.mockResolvedValue([
      feeFixture({ id: 'fee-daily', name: 'Daily Fee', feeType: 'DAILY', amount: '10.00' }),
      feeFixture({ id: 'fee-pa', name: 'PA Fee', feeType: 'PA', amount: '1.00' }),
    ])
  })

  it('renders the payments list', async () => {
    PERMISSIONS = ['finance.view']
    renderPage()

    expect((await screen.findAllByText('PAY-2026-0001')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThan(0)
    expect(screen.getAllByText('50,000.00').length).toBeGreaterThan(0)
  })

  it('hides the record button without payments.record (view-only roles)', async () => {
    PERMISSIONS = ['finance.view']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    expect(screen.queryByRole('button', { name: /Record payment/i })).not.toBeInTheDocument()
  })

  it('records a payment with Paid/Not Paid toggles without payment method', async () => {
    PERMISSIONS = ['finance.view', 'payments.record']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    fireEvent.click(screen.getByRole('button', { name: /Record payment/i }))

    fireEvent.change(screen.getByLabelText(/^Search pupil/), { target: { value: 'Ama' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    const pupilOption = await screen.findByRole('button', { name: /Ama Mensah/ })
    fireEvent.click(pupilOption)

    const dailyPaidBtns = screen.getAllByRole('button', { name: 'Paid' })
    fireEvent.click(dailyPaidBtns[0])

    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))

    await waitFor(() => {
      expect(apiMock.markPaid).toHaveBeenCalledWith(
        expect.objectContaining({
          pupilId: 'pupil-1',
          dailyPaid: true,
          paPaid: false,
        }),
      )
    })
    expect(apiMock.markPaid).toHaveBeenCalledWith(
      expect.not.objectContaining({
        paymentMethod: expect.anything(),
      }),
    )
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('PAY-2026-0002'))
  })

  it('requires a pupil to be selected before recording', async () => {
    PERMISSIONS = ['finance.view', 'payments.record']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    fireEvent.click(screen.getByRole('button', { name: /Record payment/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))

    expect(await screen.findByText('Select a pupil.')).toBeInTheDocument()
    expect(apiMock.markPaid).not.toHaveBeenCalled()
  })

  it('shows configured fee amounts from fee structure', async () => {
    PERMISSIONS = ['finance.view', 'payments.record']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    fireEvent.click(screen.getByRole('button', { name: /Record payment/i }))

    fireEvent.change(screen.getByLabelText(/^Search pupil/), { target: { value: 'Ama' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    const pupilOption = await screen.findByRole('button', { name: /Ama Mensah/ })
    fireEvent.click(pupilOption)

    expect(await screen.findAllByText('Configured amount:')).toHaveLength(2)
    expect(screen.getByText('10.00')).toBeInTheDocument()
    expect(screen.getByText('1.00')).toBeInTheDocument()
  })

  it('displays automatically determined payment date', async () => {
    PERMISSIONS = ['finance.view', 'payments.record']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    fireEvent.click(screen.getByRole('button', { name: /Record payment/i }))

    expect(screen.getByText('Payment Date')).toBeInTheDocument()
    expect(screen.getByText('Automatically determined by the system.')).toBeInTheDocument()
  })

  it('does not show payment method, date, or note fields in the form', async () => {
    PERMISSIONS = ['finance.view', 'payments.record']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    fireEvent.click(screen.getByRole('button', { name: /Record payment/i }))

    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })
    expect(within(dialog).queryByLabelText(/Payment method/i)).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/Payment date/i)).not.toBeInTheDocument()
    expect(within(dialog).queryByLabelText(/Note/i)).not.toBeInTheDocument()
  })

  it('shows an empty state when there are no payments', async () => {
    PERMISSIONS = ['finance.view']
    apiMock.listPayments.mockResolvedValue(resultFixture({ items: [], total: 0 }))
    renderPage()

    expect(await screen.findByText('No payments found.')).toBeInTheDocument()
  })
})
