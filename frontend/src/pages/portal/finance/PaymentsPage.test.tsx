import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PaymentsPage } from './PaymentsPage'
import type { PaymentListResult, PaymentView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listPayments: vi.fn(),
  listFinancePupils: vi.fn(),
  createPayment: vi.fn(),
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
    apiMock.createPayment.mockResolvedValue(paymentFixture({ paymentReference: 'PAY-2026-0002' }))
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

  it('records a payment with a searched pupil and amount', async () => {
    PERMISSIONS = ['finance.view', 'payments.record']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    fireEvent.click(screen.getByRole('button', { name: /Record payment/i }))

    fireEvent.change(screen.getByLabelText(/^Search pupil/), { target: { value: 'Ama' } })
    fireEvent.click(screen.getByRole('button', { name: 'Search' }))

    const pupilOption = await screen.findByRole('button', { name: /Ama Mensah/ })
    fireEvent.click(pupilOption)

    fireEvent.change(screen.getByLabelText(/^Amount paid/), { target: { value: '100000.00' } })
    fireEvent.change(screen.getByLabelText(/^Payment method/), { target: { value: 'BANK_TRANSFER' } })
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))

    await waitFor(() => {
      expect(apiMock.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          pupilId: 'pupil-1',
          amountPaid: '100000.00',
          paymentMethod: 'BANK_TRANSFER',
        }),
      )
    })
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('PAY-2026-0002'))
  })

  it('keeps input focus while typing the amount in the record form', async () => {
    PERMISSIONS = ['finance.view', 'payments.record']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    fireEvent.click(screen.getByRole('button', { name: /Record payment/i }))

    const amount = screen.getByLabelText(/^Amount paid/)
    amount.focus()
    fireEvent.change(amount, { target: { value: '1' } })
    fireEvent.change(amount, { target: { value: '12' } })
    fireEvent.change(amount, { target: { value: '12000' } })

    expect(amount).toBe(document.activeElement)
  })

  it('requires a pupil to be selected before recording', async () => {
    PERMISSIONS = ['finance.view', 'payments.record']
    renderPage()

    await screen.findAllByText('PAY-2026-0001')
    fireEvent.click(screen.getByRole('button', { name: /Record payment/i }))

    fireEvent.change(screen.getByLabelText(/^Amount paid/), { target: { value: '1000.00' } })
    fireEvent.change(screen.getByLabelText(/^Payment method/), { target: { value: 'CASH' } })
    const dialog = await screen.findByRole('dialog', { name: 'Record payment' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Record payment' }))

    expect(await screen.findByText('Select a pupil.')).toBeInTheDocument()
    expect(apiMock.createPayment).not.toHaveBeenCalled()
  })

  it('shows an empty state when there are no payments', async () => {
    PERMISSIONS = ['finance.view']
    apiMock.listPayments.mockResolvedValue(resultFixture({ items: [], total: 0 }))
    renderPage()

    expect(await screen.findByText('No payments found.')).toBeInTheDocument()
  })
})