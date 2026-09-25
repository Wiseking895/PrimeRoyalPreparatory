import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ReconciliationPage } from './ReconciliationPage'
import type { CombinedReconciliationView, CombinedReconciliationPupilRow, CombinedReconciliationClassSummary } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  getCombinedReconciliation: vi.fn(),
  listClasses: vi.fn(),
  markPaid: vi.fn(),
  markUnpaid: vi.fn(),
  createAttendance: vi.fn(),
  updateAttendance: vi.fn(),
  listAttendance: vi.fn(),
  updateReconciliationAttendance: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: apiMock }))

const pushMock = vi.hoisted(() => vi.fn())

vi.mock('@/components/dashboard/Toast', () => ({
  useToast: () => ({ push: pushMock }),
}))

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
      permissions: ['finance.view', 'payments.record'],
    },
    hasPermission: (key: string) => ['finance.view', 'payments.record'].includes(key),
  }),
}))

function pupilRowFixture(overrides: Partial<CombinedReconciliationPupilRow> = {}): CombinedReconciliationPupilRow {
  return {
    pupilId: 'p-1',
    pupilCode: 'PRPS-P-001',
    fullName: 'Ama Mensah',
    className: 'Primary 1',
    classId: 'c-1',
    attendanceStatus: 'PRESENT',
    dailyAssignmentStatus: 'ACTIVE',
    paAssignmentStatus: 'ACTIVE',
    dailyFeeAmount: '10.00',
    dailyPaidAmount: '10.00',
    dailyStatus: 'PAID',
    paFeeAmount: '1.00',
    paPaidAmount: '0.00',
    paStatus: 'NOT_PAID',
    outstanding: '1.00',
    overallStatus: 'PARTIALLY_PAID',
    ...overrides,
  }
}

function classSummaryFixture(overrides: Partial<CombinedReconciliationClassSummary> = {}): CombinedReconciliationClassSummary {
  return {
    classId: 'c-1',
    className: 'Primary 1',
    totalPupils: 3,
    presentCount: 2,
    absentCount: 1,
    pupils: [
      pupilRowFixture({ pupilId: 'p-1', pupilCode: 'PRPS-P-001', fullName: 'Ama Mensah', overallStatus: 'PAID', dailyStatus: 'PAID', paStatus: 'PAID', outstanding: '0.00' }),
      pupilRowFixture({ pupilId: 'p-2', pupilCode: 'PRPS-P-002', fullName: 'Kofi Mensah', overallStatus: 'PARTIALLY_PAID', dailyStatus: 'PAID', paStatus: 'NOT_PAID', outstanding: '1.00' }),
      pupilRowFixture({ pupilId: 'p-3', pupilCode: 'PRPS-P-003', fullName: 'Aba Boateng', attendanceStatus: null, overallStatus: 'ABSENT', dailyStatus: 'NOT_PAID', paStatus: 'NOT_PAID', outstanding: '0.00' }),
    ],
    ...overrides,
  }
}

function combinedReconciliationFixture(overrides: Partial<CombinedReconciliationView> = {}): CombinedReconciliationView {
  return {
    date: '2026-01-05',
    sessionId: 's-1',
    sessionName: '2025/2026 Academic Year',
    termName: 'First Term',
    dailyFeeAmount: '10.00',
    paFeeAmount: '1.00',
    isClosed: false,
    closedAt: null,
    closedByName: null,
    classes: [classSummaryFixture()],
    totals: {
      totalPupils: 3,
      presentCount: 2,
      absentCount: 1,
      dailyPaidCount: 2,
      dailyNotPaidCount: 1,
      paPaidCount: 1,
      paNotPaidCount: 2,
      fullyPaidCount: 1,
      partiallyPaidCount: 1,
      notPaidCount: 0,
      exemptCount: 0,
      totalOutstanding: '1.00',
      totalDailyCollected: '20.00',
      totalPaCollected: '1.00',
    },
    ...overrides,
  }
}

function classFixture(overrides: { id: string; name: string; status: string } = { id: 'c-1', name: 'Primary 1', status: 'ACTIVE' }) {
  return overrides
}

describe('ReconciliationPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMock.getCombinedReconciliation.mockResolvedValue(combinedReconciliationFixture())
    apiMock.listClasses.mockResolvedValue([classFixture()])
    apiMock.markPaid.mockResolvedValue({})
    apiMock.markUnpaid.mockResolvedValue({ voided: 1 })
    apiMock.createAttendance.mockResolvedValue({})
    apiMock.updateAttendance.mockResolvedValue({})
    apiMock.listAttendance.mockResolvedValue([])
    apiMock.updateReconciliationAttendance.mockResolvedValue({})
  })

  it('renders the reconciliation page with stats and pupil table', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Daily Reconciliation')).toBeInTheDocument()
    })

    expect(
      screen.getByText(/Daily collection and attendance for one school day/),
    ).toBeInTheDocument()
    expect(screen.getAllByText('Primary 1').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('3 pupils')).toBeInTheDocument()
    expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Kofi Mensah').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Aba Boateng').length).toBeGreaterThanOrEqual(1)
  })

  it('displays Present, Paid, Not Paid, and Absent badges correctly', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    })

    // Attendance badges
    expect(screen.getAllByText('Present').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Absent').length).toBeGreaterThanOrEqual(1)
    // Fee status badges - use regex to match button text
    expect(screen.getAllByText(/✓ Paid/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/✕ Not Paid/).length).toBeGreaterThanOrEqual(1)
    // Overall status
    expect(screen.getAllByText('Fully Paid').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Partially Paid').length).toBeGreaterThanOrEqual(1)
  })

  it('displays session and term context information with GHS currency', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/2025\/2026 Academic Year/)).toBeInTheDocument()
    })

    expect(screen.getByText(/First Term/)).toBeInTheDocument()
    expect(screen.getByText(/Daily Fee: GHS 10\.00/)).toBeInTheDocument()
    expect(screen.getByText(/PA Fee: GHS 1\.00/)).toBeInTheDocument()
  })

  it('shows error state when API call fails', async () => {
    apiMock.getCombinedReconciliation.mockRejectedValueOnce(new Error('Network error'))

    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument()
    })
  })

  it('shows empty state when no classes are returned', async () => {
    apiMock.getCombinedReconciliation.mockResolvedValue(combinedReconciliationFixture({ classes: [], totals: { totalPupils: 0, presentCount: 0, absentCount: 0, dailyPaidCount: 0, dailyNotPaidCount: 0, paPaidCount: 0, paNotPaidCount: 0, fullyPaidCount: 0, partiallyPaidCount: 0, notPaidCount: 0, exemptCount: 0, totalOutstanding: '0.00', totalDailyCollected: '0.00', totalPaCollected: '0.00' } }))

    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('No classes found.')).toBeInTheDocument()
    })
  })

  it('renders summary stats cards with correct labels', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Total Pupils')).toBeInTheDocument()
      expect(screen.getAllByText('Present').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Absent').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Daily Collected').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('PA Collected').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('fetches combined reconciliation with new date when date input changes', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Daily Reconciliation')).toBeInTheDocument()
    })

    expect(apiMock.getCombinedReconciliation).toHaveBeenCalledTimes(1)

    const dateInput = screen.getByLabelText('Date')
    fireEvent.change(dateInput, { target: { value: '2026-03-10' } })

    await waitFor(() => {
      expect(apiMock.getCombinedReconciliation).toHaveBeenCalledTimes(2)
    })

    expect(apiMock.getCombinedReconciliation).toHaveBeenLastCalledWith('2026-03-10', undefined, undefined)
  })

  it('fetches combined reconciliation with class filter when class selector changes', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Daily Reconciliation')).toBeInTheDocument()
    })

    expect(apiMock.getCombinedReconciliation).toHaveBeenCalledTimes(1)

    const classSelect = screen.getByLabelText('Class')
    fireEvent.change(classSelect, { target: { value: 'c-1' } })

    await waitFor(() => {
      expect(apiMock.getCombinedReconciliation).toHaveBeenCalledTimes(2)
    })

    expect(apiMock.getCombinedReconciliation).toHaveBeenLastCalledWith(expect.any(String), 'c-1', undefined)
  })

  it('fetches combined reconciliation with search query when search input changes', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Daily Reconciliation')).toBeInTheDocument()
    })

    expect(apiMock.getCombinedReconciliation).toHaveBeenCalledTimes(1)

    const searchInput = screen.getByLabelText('Search')
    fireEvent.change(searchInput, { target: { value: 'Kofi' } })

    await waitFor(() => {
      expect(apiMock.getCombinedReconciliation).toHaveBeenCalledTimes(2)
    })

    expect(apiMock.getCombinedReconciliation).toHaveBeenLastCalledWith(expect.any(String), undefined, 'Kofi')
  })

  it('refetches data when Refresh button is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Daily Reconciliation')).toBeInTheDocument()
    })

    expect(apiMock.getCombinedReconciliation).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }))

    await waitFor(() => {
      expect(apiMock.getCombinedReconciliation).toHaveBeenCalledTimes(2)
    })
  })

  it('shows loading skeleton before data loads', async () => {
    let resolvePromise: (value: CombinedReconciliationView) => void
    apiMock.getCombinedReconciliation.mockReturnValue(new Promise((resolve) => { resolvePromise = resolve }))

    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    expect(document.querySelector('.animate-pulse')).toBeInTheDocument()

    resolvePromise!(combinedReconciliationFixture())

    await waitFor(() => {
      expect(screen.getByText('Daily Reconciliation')).toBeInTheDocument()
    })

    expect(document.querySelector('.animate-pulse')).not.toBeInTheDocument()
  })

  it('renders Exempt badge for exempted pupils', async () => {
    apiMock.getCombinedReconciliation.mockResolvedValue(combinedReconciliationFixture({
      classes: [
        classSummaryFixture({
          totalPupils: 2,
          presentCount: 2,
          absentCount: 0,
          pupils: [
            pupilRowFixture({ pupilId: 'p-1', pupilCode: 'PRPS-P-001', fullName: 'Ama Mensah', overallStatus: 'PAID', dailyStatus: 'PAID', paStatus: 'PAID', outstanding: '0.00' }),
            pupilRowFixture({ pupilId: 'p-4', pupilCode: 'PRPS-P-004', fullName: 'Kwame Nkrumah', dailyAssignmentStatus: 'EXEMPT', paAssignmentStatus: 'EXEMPT', dailyStatus: 'EXEMPT', paStatus: 'EXEMPT', overallStatus: 'EXEMPT', outstanding: '0.00' }),
          ],
        }),
      ],
      totals: { totalPupils: 2, presentCount: 2, absentCount: 0, dailyPaidCount: 1, dailyNotPaidCount: 0, paPaidCount: 1, paNotPaidCount: 0, fullyPaidCount: 1, partiallyPaidCount: 0, notPaidCount: 0, exemptCount: 1, totalOutstanding: '0.00', totalDailyCollected: '10.00', totalPaCollected: '1.00' },
    }))

    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getAllByText('Exempt').length).toBeGreaterThanOrEqual(1)
  })

  it('renders multiple classes with correct pupil counts', async () => {
    apiMock.getCombinedReconciliation.mockResolvedValue(combinedReconciliationFixture({
      classes: [
        classSummaryFixture({
          classId: 'c-1',
          className: 'Primary 1',
          totalPupils: 2,
          presentCount: 2,
          absentCount: 0,
          pupils: [
            pupilRowFixture({ pupilId: 'p-1', pupilCode: 'PRPS-P-001', fullName: 'Ama Mensah', className: 'Primary 1', overallStatus: 'PAID', dailyStatus: 'PAID', paStatus: 'PAID', outstanding: '0.00' }),
            pupilRowFixture({ pupilId: 'p-2', pupilCode: 'PRPS-P-002', fullName: 'Kofi Mensah', className: 'Primary 1', overallStatus: 'PARTIALLY_PAID', dailyStatus: 'PAID', paStatus: 'NOT_PAID', outstanding: '1.00' }),
          ],
        }),
        classSummaryFixture({
          classId: 'c-2',
          className: 'Primary 2',
          totalPupils: 1,
          presentCount: 0,
          absentCount: 1,
          pupils: [
            pupilRowFixture({ pupilId: 'p-5', pupilCode: 'PRPS-P-005', fullName: 'Efua Mensah', className: 'Primary 2', attendanceStatus: null, overallStatus: 'ABSENT', dailyStatus: 'NOT_PAID', paStatus: 'NOT_PAID', outstanding: '0.00' }),
          ],
        }),
      ],
      totals: { totalPupils: 3, presentCount: 2, absentCount: 1, dailyPaidCount: 2, dailyNotPaidCount: 1, paPaidCount: 1, paNotPaidCount: 2, fullyPaidCount: 1, partiallyPaidCount: 1, notPaidCount: 0, exemptCount: 0, totalOutstanding: '1.00', totalDailyCollected: '20.00', totalPaCollected: '1.00' },
    }))

    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Primary 1').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getAllByText('Primary 2').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('2 pupils')).toBeInTheDocument()
    expect(screen.getByText('1 pupils')).toBeInTheDocument()
    expect(screen.getAllByText('Efua Mensah').length).toBeGreaterThanOrEqual(1)
  })

  it('toggles class section expand/collapse', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    })

    const classButton = screen.getByRole('button', { name: /Primary 1/i })
    expect(classButton).toBeInTheDocument()

    fireEvent.click(classButton)

    const tableRows = screen.queryAllByText('PRPS-P-001')
    const visibleRows = tableRows.filter((el) => el.offsetParent !== null)
    expect(visibleRows.length).toBe(0)

    fireEvent.click(classButton)

    await waitFor(() => {
      expect(screen.getAllByText('PRPS-P-001').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('displays pupil codes in the table', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('PRPS-P-001').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getAllByText('PRPS-P-002').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('PRPS-P-003').length).toBeGreaterThanOrEqual(1)
  })

  it('displays per-pupil fee and paid amounts in the table', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText(/10\.00/).length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.getAllByText(/1\.00/).length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText(/0\.00/).length).toBeGreaterThanOrEqual(1)
  })

  it('shows total stats cards with correct counts', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Total Pupils')).toBeInTheDocument()
    })

    expect(screen.getAllByText('Present').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Absent').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Daily Collected').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('PA Collected').length).toBeGreaterThanOrEqual(1)
  })

  it('shows revenue summary cards with correct amounts', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Total Outstanding')).toBeInTheDocument()
      expect(screen.getAllByText('Fully Paid').length).toBeGreaterThanOrEqual(1)
      expect(screen.getAllByText('Partially Paid').length).toBeGreaterThanOrEqual(1)
    })
  })

  it('shows per-class present and absent counts in header', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('2 present')).toBeInTheDocument()
    })

    expect(screen.getByText('1 absent')).toBeInTheDocument()
  })

  it('shows retry button on error and refetches on click', async () => {
    apiMock.getCombinedReconciliation.mockRejectedValueOnce(new Error('Server error'))

    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Server error')).toBeInTheDocument()
    })

    const retryButton = screen.getByRole('button', { name: /try again/i })
    expect(retryButton).toBeInTheDocument()

    apiMock.getCombinedReconciliation.mockResolvedValue(combinedReconciliationFixture())

    fireEvent.click(retryButton)

    await waitFor(() => {
      expect(screen.getByText('Daily Reconciliation')).toBeInTheDocument()
    })

    expect(apiMock.getCombinedReconciliation).toHaveBeenCalledTimes(2)
  })

  it('renders mobile list alongside desktop table', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    })

    const allAmaMensah = screen.getAllByText('Ama Mensah')
    expect(allAmaMensah.length).toBeGreaterThanOrEqual(2)
  })

  it('displays daily and PA fee amounts in GHS', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText(/Daily Fee: GHS 10\.00/)).toBeInTheDocument()
      expect(screen.getByText(/PA Fee: GHS 1\.00/)).toBeInTheDocument()
    })
  })

  it('does not display fee amounts underneath the status buttons', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    })

    const ghsElements = screen.queryAllByText(/^GHS/)
    for (const el of ghsElements) {
      const parent = el.closest('td')
      if (parent) {
        const hasButton = parent.querySelector('button')
        if (hasButton) {
          expect(el).not.toHaveClass('text-xs')
        }
      }
    }
  })

  it('attendance button uses danger variant when absent', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    })

    const absentButtons = screen.getAllByText(/✕ Absent/)
    expect(absentButtons.length).toBeGreaterThanOrEqual(1)
    for (const btn of absentButtons) {
      expect(btn.className).toContain('bg-red-600')
    }
  })

  it('attendance button uses success variant when present', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    })

    const presentButtons = screen.getAllByText(/✓ Present/)
    expect(presentButtons.length).toBeGreaterThanOrEqual(1)
    for (const btn of presentButtons) {
      expect(btn.className).toContain('bg-emerald-600')
    }
  })

  it('calls markUnpaid when toggling Paid daily fee to Not Paid', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    })

    const paidButtons = screen.getAllByText(/✓ Paid/)
    const firstPaidButton = paidButtons[0]
    fireEvent.click(firstPaidButton)

    await waitFor(() => {
      expect(apiMock.markUnpaid).toHaveBeenCalled()
    })
    expect(apiMock.markPaid).not.toHaveBeenCalled()
  })

  it('calls markPaid when toggling Not Paid daily fee to Paid', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    })

    const notPaidButtons = screen.getAllByText(/✕ Not Paid/)
    const firstNotPaidButton = notPaidButtons[0]
    fireEvent.click(firstNotPaidButton)

    await waitFor(() => {
      expect(apiMock.markPaid).toHaveBeenCalled()
    })
    expect(apiMock.markUnpaid).not.toHaveBeenCalled()
  })

  it('has accessible labels with pupil names on buttons', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    })

    const presentBtns = screen.getAllByRole('button', { name: /Mark Ama Mensah/i })
    expect(presentBtns.length).toBeGreaterThanOrEqual(3)

    const abeAbsentBtns = screen.getAllByRole('button', { name: /Mark Aba Boateng/i })
    expect(abeAbsentBtns.length).toBeGreaterThanOrEqual(3)
  })

  it('calls updateReconciliationAttendance with status and date instead of the generic attendance APIs', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    })

    const absentBtns = screen.getAllByRole('button', { name: /Mark Ama Mensah absent/i })
    expect(absentBtns.length).toBeGreaterThanOrEqual(1)
    fireEvent.click(absentBtns[0])

    await waitFor(() => {
      expect(apiMock.updateReconciliationAttendance).toHaveBeenCalledWith({
        pupilId: 'p-1',
        date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        status: 'ABSENT',
      })
    })
    expect(apiMock.createAttendance).not.toHaveBeenCalled()
    expect(apiMock.updateAttendance).not.toHaveBeenCalled()
    expect(apiMock.listAttendance).not.toHaveBeenCalled()
  })

  it('toggles Present to Absent through the reconciliation endpoint', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Mark Ama Mensah absent/i }).length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Mark Ama Mensah absent/i })[0])

    await waitFor(() => {
      expect(apiMock.updateReconciliationAttendance).toHaveBeenCalledWith(
        expect.objectContaining({ pupilId: 'p-1', status: 'ABSENT' }),
      )
    })
    expect(apiMock.createAttendance).not.toHaveBeenCalled()
    expect(apiMock.updateAttendance).not.toHaveBeenCalled()
  })

  it('toggles Absent to Present through the reconciliation endpoint', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Mark Aba Boateng present/i }).length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Mark Aba Boateng present/i })[0])

    await waitFor(() => {
      expect(apiMock.updateReconciliationAttendance).toHaveBeenCalledWith(
        expect.objectContaining({ pupilId: 'p-3', status: 'PRESENT' }),
      )
    })
    expect(apiMock.createAttendance).not.toHaveBeenCalled()
    expect(apiMock.updateAttendance).not.toHaveBeenCalled()
  })

  it('refetches after a successful attendance toggle so the badge reflects server state', async () => {
    apiMock.getCombinedReconciliation.mockResolvedValueOnce(combinedReconciliationFixture())
      .mockResolvedValue(
        combinedReconciliationFixture({
          classes: [
            classSummaryFixture({
              pupils: [
                pupilRowFixture({ pupilId: 'p-1', pupilCode: 'PRPS-P-001', fullName: 'Ama Mensah', overallStatus: 'PAID', dailyStatus: 'PAID', paStatus: 'PAID', outstanding: '0.00' }),
                pupilRowFixture({ pupilId: 'p-2', pupilCode: 'PRPS-P-002', fullName: 'Kofi Mensah', overallStatus: 'PARTIALLY_PAID', dailyStatus: 'PAID', paStatus: 'NOT_PAID', outstanding: '1.00' }),
                pupilRowFixture({ pupilId: 'p-3', pupilCode: 'PRPS-P-003', fullName: 'Aba Boateng', attendanceStatus: 'PRESENT', overallStatus: 'PAID', dailyStatus: 'PAID', paStatus: 'PAID', outstanding: '0.00' }),
              ],
              presentCount: 3,
              absentCount: 0,
            }),
          ],
          totals: {
            totalPupils: 3,
            presentCount: 3,
            absentCount: 0,
            dailyPaidCount: 3,
            dailyNotPaidCount: 0,
            paPaidCount: 2,
            paNotPaidCount: 1,
            fullyPaidCount: 2,
            partiallyPaidCount: 1,
            notPaidCount: 0,
            exemptCount: 0,
            totalOutstanding: '1.00',
            totalDailyCollected: '30.00',
            totalPaCollected: '1.00',
          },
        }),
      )

    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Mark Aba Boateng present/i }).length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Mark Aba Boateng present/i })[0])

    await waitFor(() => {
      expect(apiMock.updateReconciliationAttendance).toHaveBeenCalledTimes(1)
      expect(apiMock.getCombinedReconciliation).toHaveBeenCalledTimes(2)
    })

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Mark Aba Boateng absent/i }).length).toBeGreaterThanOrEqual(1)
    })
    expect(screen.getByText('3 present')).toBeInTheDocument()
    expect(screen.queryByText('1 absent')).not.toBeInTheDocument()
  })

  it('keeps the prior attendance state and surfaces an error when the toggle fails', async () => {
    apiMock.updateReconciliationAttendance.mockRejectedValueOnce(new Error('Not authorized'))

    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByRole('button', { name: /Mark Ama Mensah absent/i }).length).toBeGreaterThanOrEqual(1)
    })

    fireEvent.click(screen.getAllByRole('button', { name: /Mark Ama Mensah absent/i })[0])

    await waitFor(() => {
      expect(screen.getByText('Not authorized')).toBeInTheDocument()
    })
    expect(screen.getAllByText(/✓ Present/).length).toBeGreaterThanOrEqual(1)
    expect(apiMock.createAttendance).not.toHaveBeenCalled()
    expect(apiMock.updateAttendance).not.toHaveBeenCalled()
  })

  it('renders class reconciliation first, then summary, then Close & Sign', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    const classesSection = await screen.findByTestId('reconciliation-classes')
    const grid = screen.getByTestId('reconciliation-summary')
    const closeBtn = screen.getByRole('button', { name: 'Close & Sign' })

    expect(classesSection.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(grid.compareDocumentPosition(closeBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    const firstClassHeader = within(classesSection).getByRole('button', { name: /Primary 1/i })
    expect(firstClassHeader.compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getAllByText('Ama Mensah')[0].compareDocumentPosition(grid) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(grid.compareDocumentPosition(screen.getAllByText('Ama Mensah')[0]) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
  })

  it('renders exactly 8 summary cards in the specified order with Total Outstanding last', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    const grid = await screen.findByTestId('reconciliation-summary')
    expect(grid.childElementCount).toBe(8)

    const labels = [
      'Total Pupils',
      'Present',
      'Absent',
      'Daily Collected',
      'PA Collected',
      'Fully Paid',
      'Partially Paid',
      'Total Outstanding',
    ]
    const nodes = labels.map((label) => within(grid).getByText(label))
    nodes.forEach((node, i) => {
      for (let j = i + 1; j < nodes.length; j++) {
        expect(node.compareDocumentPosition(nodes[j]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      }
    })

    expect(grid.lastElementChild).toContainElement(within(grid).getByText('Total Outstanding'))
    expect(within(grid).getByText('Total Outstanding').previousElementSibling).toHaveTextContent('GHS 1.00')
  })

  it('shows secondary hints for Daily Collected, PA Collected, Fully Paid, Partially Paid and Total Outstanding', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    const grid = await screen.findByTestId('reconciliation-summary')
    expect(within(grid).getByText('2 paid · 1 unpaid')).toBeInTheDocument()
    expect(within(grid).getByText('1 paid · 2 unpaid')).toBeInTheDocument()
    expect(within(grid).getByText('Both fees paid')).toBeInTheDocument()
    expect(within(grid).getByText('One fee paid, one outstanding')).toBeInTheDocument()
    expect(within(grid).getByText('From 0 unpaid pupils')).toBeInTheDocument()
  })

  it('updates summary totals live after a fee status toggle', async () => {
    apiMock.getCombinedReconciliation.mockResolvedValueOnce(combinedReconciliationFixture())
      .mockResolvedValue(
        combinedReconciliationFixture({
          classes: [
            classSummaryFixture({
              pupils: [
                pupilRowFixture({ pupilId: 'p-1', pupilCode: 'PRPS-P-001', fullName: 'Ama Mensah', overallStatus: 'PAID', dailyStatus: 'PAID', paStatus: 'PAID', outstanding: '0.00' }),
                pupilRowFixture({ pupilId: 'p-2', pupilCode: 'PRPS-P-002', fullName: 'Kofi Mensah', overallStatus: 'PAID', dailyStatus: 'PAID', paStatus: 'PAID', dailyPaidAmount: '10.00', paPaidAmount: '1.00', outstanding: '0.00' }),
                pupilRowFixture({ pupilId: 'p-3', pupilCode: 'PRPS-P-003', fullName: 'Aba Boateng', attendanceStatus: null, overallStatus: 'ABSENT', dailyStatus: 'NOT_PAID', paStatus: 'NOT_PAID', outstanding: '11.00' }),
              ],
            }),
          ],
          totals: {
            totalPupils: 3,
            presentCount: 2,
            absentCount: 1,
            dailyPaidCount: 2,
            dailyNotPaidCount: 1,
            paPaidCount: 2,
            paNotPaidCount: 1,
            fullyPaidCount: 2,
            partiallyPaidCount: 0,
            notPaidCount: 1,
            exemptCount: 0,
            totalOutstanding: '11.00',
            totalDailyCollected: '20.00',
            totalPaCollected: '2.00',
          },
        }),
      )

    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    const grid = await screen.findByTestId('reconciliation-summary')
    expect(within(grid).getByText('Total Outstanding').previousElementSibling).toHaveTextContent('GHS 1.00')

    fireEvent.click(screen.getAllByRole('button', { name: /Mark Kofi Mensah pa fee paid/i })[0])

    await waitFor(() => {
      expect(apiMock.markPaid).toHaveBeenCalledWith(expect.objectContaining({ pupilId: 'p-2', paPaid: true }))
    })
    await waitFor(() => {
      expect(within(grid).getByText('Total Outstanding').previousElementSibling).toHaveTextContent('GHS 11.00')
    })

    expect(within(grid).getByText('From 1 unpaid pupils')).toBeInTheDocument()
    expect(within(grid).getByText('Fully Paid').previousElementSibling).toHaveTextContent('2')
    expect(within(grid).getByText('Partially Paid').previousElementSibling).toHaveTextContent('0')
    expect(within(grid).getAllByText('2 paid · 1 unpaid')).toHaveLength(2)
  })

  it('updates Present and Absent summary cards when attendance is toggled', async () => {
    apiMock.getCombinedReconciliation.mockResolvedValueOnce(combinedReconciliationFixture())
      .mockResolvedValue(
        combinedReconciliationFixture({
          classes: [
            classSummaryFixture({
              pupils: [
                pupilRowFixture({ pupilId: 'p-1', pupilCode: 'PRPS-P-001', fullName: 'Ama Mensah', attendanceStatus: null, overallStatus: 'ABSENT', dailyStatus: 'PAID', paStatus: 'NOT_PAID', outstanding: '1.00' }),
                pupilRowFixture({ pupilId: 'p-2', pupilCode: 'PRPS-P-002', fullName: 'Kofi Mensah', overallStatus: 'PARTIALLY_PAID', dailyStatus: 'PAID', paStatus: 'NOT_PAID', outstanding: '1.00' }),
                pupilRowFixture({ pupilId: 'p-3', pupilCode: 'PRPS-P-003', fullName: 'Aba Boateng', attendanceStatus: null, overallStatus: 'ABSENT', dailyStatus: 'NOT_PAID', paStatus: 'NOT_PAID', outstanding: '0.00' }),
              ],
              presentCount: 1,
              absentCount: 2,
            }),
          ],
          totals: {
            totalPupils: 3,
            presentCount: 1,
            absentCount: 2,
            dailyPaidCount: 2,
            dailyNotPaidCount: 1,
            paPaidCount: 0,
            paNotPaidCount: 3,
            fullyPaidCount: 0,
            partiallyPaidCount: 1,
            notPaidCount: 1,
            exemptCount: 0,
            totalOutstanding: '2.00',
            totalDailyCollected: '20.00',
            totalPaCollected: '0.00',
          },
        }),
      )

    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    const grid = await screen.findByTestId('reconciliation-summary')
    expect(within(grid).getByText('Present').previousElementSibling).toHaveTextContent('2')
    expect(within(grid).getByText('Absent').previousElementSibling).toHaveTextContent('1')

    fireEvent.click(screen.getAllByRole('button', { name: /Mark Ama Mensah absent/i })[0])

    await waitFor(() => {
      expect(within(grid).getByText('Present').previousElementSibling).toHaveTextContent('1')
    })
    expect(within(grid).getByText('Absent').previousElementSibling).toHaveTextContent('2')
  })

  it('shows date-specific totals after changing the date', async () => {
    apiMock.getCombinedReconciliation.mockResolvedValueOnce(combinedReconciliationFixture())
      .mockResolvedValueOnce(
        combinedReconciliationFixture({
          date: '2026-03-10',
          classes: [],
          totals: {
            totalPupils: 7,
            presentCount: 7,
            absentCount: 0,
            dailyPaidCount: 7,
            dailyNotPaidCount: 0,
            paPaidCount: 7,
            paNotPaidCount: 0,
            fullyPaidCount: 7,
            partiallyPaidCount: 0,
            notPaidCount: 0,
            exemptCount: 0,
            totalOutstanding: '0.00',
            totalDailyCollected: '70.00',
            totalPaCollected: '7.00',
          },
        }),
      )

    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    const grid = await screen.findByTestId('reconciliation-summary')
    expect(within(grid).getByText('Total Pupils').previousElementSibling).toHaveTextContent('3')

    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-03-10' } })

    await waitFor(() => {
      expect(apiMock.getCombinedReconciliation).toHaveBeenCalledTimes(2)
    })
    await waitFor(() => {
      expect(within(grid).getByText('Total Pupils').previousElementSibling).toHaveTextContent('7')
    })

    expect(within(grid).getByText('GHS 70.00')).toBeInTheDocument()
    expect(within(grid).getByText('GHS 0.00')).toBeInTheDocument()
    expect(within(grid).getByText('From 0 unpaid pupils')).toBeInTheDocument()
  })

  it('renders Close & Sign as a bottom-right pill after the records and opens the confirm dialog', async () => {
    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getAllByText('Ama Mensah').length).toBeGreaterThanOrEqual(1)
    })

    expect(screen.queryByText('Close & Sign Daily Fees')).not.toBeInTheDocument()
    expect(screen.getByText(/Review all records above/)).toBeInTheDocument()

    const btn = screen.getByRole('button', { name: 'Close & Sign' })
    expect(btn.className).toContain('rounded-full')
    expect(btn.className).toContain('bg-emerald-600')

    const tablePupil = screen.getAllByText('Ama Mensah')[0]
    expect(tablePupil.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const grid = screen.getByTestId('reconciliation-summary')
    expect(grid.compareDocumentPosition(btn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(btn)
    expect(screen.getByText('Daily Collection Summary')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Close & Sign Daily Fees' })).toBeInTheDocument()
  })

  it('hides Close & Sign when the day is already closed', async () => {
    apiMock.getCombinedReconciliation.mockResolvedValue(
      combinedReconciliationFixture({
        isClosed: true,
        closedAt: '2026-01-05T16:00:00.000Z',
        closedByName: 'Ada Lovelace',
      }),
    )

    render(
      <MemoryRouter initialEntries={['/accountant/reconciliation']}>
        <ReconciliationPage />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('✓ Day Closed & Signed')).toBeInTheDocument()
    })

    expect(screen.queryByRole('button', { name: 'Close & Sign' })).not.toBeInTheDocument()
    expect(screen.queryByText(/Review all records above/)).not.toBeInTheDocument()
  })
})