import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FeeStructuresPage } from './FeeStructuresPage'
import type { AcademicSessionView, FeeView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listFees: vi.fn(),
  listSessions: vi.fn(),
  createFee: vi.fn(),
  updateFee: vi.fn(),
  setFeeStatus: vi.fn(),
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
    <MemoryRouter initialEntries={['/accountant/fees']}>
      <FeeStructuresPage />
    </MemoryRouter>,
  )
}

describe('FeeStructuresPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pushMock.mockReset()
    apiMock.listFees.mockResolvedValue([feeFixture()])
    apiMock.listSessions.mockResolvedValue([sessionFixture()])
    apiMock.createFee.mockResolvedValue(feeFixture({ id: 'fee-2', name: 'Transport' }))
    apiMock.updateFee.mockResolvedValue(feeFixture({ name: 'School Fees' }))
    apiMock.setFeeStatus.mockResolvedValue(feeFixture({ status: 'INACTIVE' }))
  })

  it('renders fee structures', async () => {
    PERMISSIONS = ['finance.view']
    renderPage()

    expect((await screen.findAllByText('School Fees')).length).toBeGreaterThan(0)
    expect(screen.getByText('Total Fees')).toBeInTheDocument()
    expect(screen.getAllByText('150,000.00').length).toBeGreaterThan(0)
  })

  it('hides create and edit controls without fees.manage (view-only roles)', async () => {
    PERMISSIONS = ['finance.view']
    renderPage()

    await screen.findAllByText('School Fees')
    expect(screen.queryByRole('button', { name: /Add Fee Structure/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Edit/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Deactivate/i })).not.toBeInTheDocument()
  })

  it('creates a fee structure with fees.manage', async () => {
    PERMISSIONS = ['finance.view', 'fees.manage']
    renderPage()

    await screen.findAllByText('School Fees')
    fireEvent.click(screen.getByRole('button', { name: /Add Fee Structure/i }))

    fireEvent.change(screen.getByLabelText(/^Fee name/), { target: { value: 'Transport' } })
    fireEvent.change(screen.getByLabelText(/^Fee type/), { target: { value: 'TERMLY' } })
    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: '12000.50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create fee structure' }))

    await waitFor(() => {
      expect(apiMock.createFee).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Transport', feeType: 'TERMLY', amount: '12000.50' }),
      )
    })
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('created'))
  })

  it('rejects an invalid amount before calling the API', async () => {
    PERMISSIONS = ['finance.view', 'fees.manage']
    renderPage()

    await screen.findAllByText('School Fees')
    fireEvent.click(screen.getByRole('button', { name: /Add Fee Structure/i }))

    fireEvent.change(screen.getByLabelText(/^Fee name/), { target: { value: 'Transport' } })
    fireEvent.change(screen.getByLabelText(/^Fee type/), { target: { value: 'TERMLY' } })
    fireEvent.change(screen.getByLabelText(/^Amount/), { target: { value: '12.345' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create fee structure' }))

    expect(await screen.findByText('Enter a valid amount with up to 2 decimal places.')).toBeInTheDocument()
    expect(apiMock.createFee).not.toHaveBeenCalled()
  })

  it('keeps input focus while typing in the fee form', async () => {
    PERMISSIONS = ['finance.view', 'fees.manage']
    renderPage()

    await screen.findAllByText('School Fees')
    fireEvent.click(screen.getByRole('button', { name: /Add Fee Structure/i }))

    const amount = screen.getByLabelText(/^Amount/)
    amount.focus()
    fireEvent.change(amount, { target: { value: '1' } })
    fireEvent.change(amount, { target: { value: '12' } })
    fireEvent.change(amount, { target: { value: '12000' } })

    expect(amount).toBe(document.activeElement)
  })

  it('shows an empty state when there are no fees', async () => {
    PERMISSIONS = ['finance.view']
    apiMock.listFees.mockResolvedValue([])
    renderPage()

    expect(await screen.findByText('No fee structures found.')).toBeInTheDocument()
  })

  it('deactivates a fee structure via the confirmation dialog', async () => {
    PERMISSIONS = ['finance.view', 'fees.manage']
    renderPage()
    await screen.findAllByText('School Fees')

    fireEvent.click(screen.getAllByRole('button', { name: 'Deactivate' })[0])
    const dialog = await screen.findByRole('dialog', { name: 'Deactivate fee structure' })
    fireEvent.click(within(dialog).getByRole('checkbox'))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => {
      expect(apiMock.setFeeStatus).toHaveBeenCalledWith('fee-1', 'INACTIVE')
    })
    expect(pushMock).toHaveBeenCalledWith('success', expect.stringContaining('deactivated'))
  })
})