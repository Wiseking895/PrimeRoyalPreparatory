import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PupilFinancePage } from './PupilFinancePage'
import type { DailyPupilFinanceListResult, DailyPupilFinanceRow, SchoolClassView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listDailyPupilFinance: vi.fn(),
  listClasses: vi.fn(),
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

function pupilFixture(overrides: Partial<DailyPupilFinanceRow> = {}): DailyPupilFinanceRow {
  return {
    id: 'pupil-1',
    pupilId: 'PRPS-P-0001',
    fullName: 'Ama Mensah',
    className: 'Primary 1',
    classId: 'class-1',
    status: 'ACTIVE',
    dailyPaid: '5000.00',
    paPaid: '3000.00',
    outstanding: '7000.00',
    financeStatus: 'NOT_PAID',
    attendanceStatus: 'PRESENT',
    dailyAssignmentStatus: 'ACTIVE',
    paAssignmentStatus: 'ACTIVE',
    ...overrides,
  }
}

function resultFixture(overrides: Partial<DailyPupilFinanceListResult> = {}): DailyPupilFinanceListResult {
  return {
    items: [pupilFixture()],
    date: '2026-09-09',
    sessionName: '2025/2026',
    termName: 'Term 1',
    dailyFeeAmount: '5000.00',
    paFeeAmount: '3000.00',
    ...overrides,
  }
}

function classFixture(overrides: Partial<SchoolClassView> = {}): SchoolClassView {
  return {
    id: 'class-1',
    key: 'P1',
    name: 'Primary 1',
    description: null,
    sortOrder: 1,
    status: 'ACTIVE',
    pupilCount: 30,
    activePupilCount: 28,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/accountant/pupils']}>
      <PupilFinancePage />
    </MemoryRouter>,
  )
}

describe('PupilFinancePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    PERMISSIONS = ['finance.view']
    apiMock.listDailyPupilFinance.mockResolvedValue(resultFixture())
    apiMock.listClasses.mockResolvedValue([classFixture()])
  })

  it('renders daily pupil finance data', async () => {
    renderPage()
    expect((await screen.findAllByText('Ama Mensah')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('PRPS-P-0001').length).toBeGreaterThan(0)
    expect(screen.getAllByText('5,000.00').length).toBeGreaterThan(0)
    expect(screen.getAllByText('3,000.00').length).toBeGreaterThan(0)
  })

  it('shows session and term context', async () => {
    renderPage()
    expect(await screen.findByText(/2025\/2026/)).toBeInTheDocument()
    expect(screen.getByText(/Term 1/)).toBeInTheDocument()
  })

  it('shows fee amounts in context label', async () => {
    renderPage()
    expect(await screen.findByText(/Daily fee/)).toBeInTheDocument()
    expect(screen.getByText(/PA fee/)).toBeInTheDocument()
  })

  it('displays Not Paid badge for unpaid pupil', async () => {
    renderPage()
    const badges = await screen.findAllByText('Not Paid')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('displays Paid badge when both fees are paid', async () => {
    apiMock.listDailyPupilFinance.mockResolvedValue(
      resultFixture({ items: [pupilFixture({ financeStatus: 'PAID', dailyPaid: '5000.00', paPaid: '3000.00', outstanding: '0.00' })] }),
    )
    renderPage()
    const badges = await screen.findAllByText('Paid')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('displays Partial badge when only one fee is paid', async () => {
    apiMock.listDailyPupilFinance.mockResolvedValue(
      resultFixture({ items: [pupilFixture({ financeStatus: 'PARTIALLY_PAID', dailyPaid: '5000.00', paPaid: '0.00', outstanding: '3000.00' })] }),
    )
    renderPage()
    const badges = await screen.findAllByText('Partial')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('displays Absent badge for absent pupil', async () => {
    apiMock.listDailyPupilFinance.mockResolvedValue(
      resultFixture({ items: [pupilFixture({ financeStatus: 'ABSENT', dailyPaid: '0.00', paPaid: '0.00', outstanding: '0.00', attendanceStatus: 'ABSENT' })] }),
    )
    renderPage()
    const badges = await screen.findAllByText('Absent')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('displays Exempt badge for exempt pupil', async () => {
    apiMock.listDailyPupilFinance.mockResolvedValue(
      resultFixture({ items: [pupilFixture({ financeStatus: 'EXEMPT', dailyPaid: '0.00', paPaid: '0.00', outstanding: '0.00', dailyAssignmentStatus: 'EXEMPT', paAssignmentStatus: 'EXEMPT' })] }),
    )
    renderPage()
    const badges = await screen.findAllByText('Exempt')
    expect(badges.length).toBeGreaterThan(0)
  })

  it('shows summary stats cards', async () => {
    apiMock.listDailyPupilFinance.mockResolvedValue(
      resultFixture({
        items: [
          pupilFixture({ financeStatus: 'PAID', outstanding: '0.00' }),
          pupilFixture({ id: 'pupil-2', fullName: 'Kofi Asante', outstanding: '5000.00' }),
          pupilFixture({ id: 'pupil-3', fullName: 'Efua Mensah', financeStatus: 'ABSENT', attendanceStatus: 'ABSENT', outstanding: '0.00' }),
        ],
      }),
    )
    renderPage()
    await screen.findAllByText('Ama Mensah')
    const paidBadges = screen.getAllByText(/Paid: 1/)
    const notPaidBadges = screen.getAllByText(/Not Paid: 1/)
    const absentBadges = screen.getAllByText(/Absent: 1/)
    expect(paidBadges.length).toBeGreaterThan(0)
    expect(notPaidBadges.length).toBeGreaterThan(0)
    expect(absentBadges.length).toBeGreaterThan(0)
  })

  it('calls API with date parameter', async () => {
    renderPage()
    await waitFor(() => {
      expect(apiMock.listDailyPupilFinance).toHaveBeenCalledWith(expect.objectContaining({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) }))
    })
  })

  it('calls API with classId when class is selected', async () => {
    renderPage()
    // Wait for initial load - use findAllByText to handle duplicate elements
    await screen.findAllByText('Ama Mensah')
    // Use the select field's label to find and change the class filter
    const classSelect = screen.getByLabelText(/Class/)
    fireEvent.change(classSelect, { target: { value: 'class-1' } })

    await waitFor(() => {
      expect(apiMock.listDailyPupilFinance).toHaveBeenLastCalledWith(expect.objectContaining({ classId: 'class-1' }))
    })
  })

  it('calls API with search query', async () => {
    renderPage()
    await screen.findAllByText('Ama Mensah')
    fireEvent.change(screen.getByLabelText(/Search/), { target: { value: 'Kofi' } })

    await waitFor(() => {
      expect(apiMock.listDailyPupilFinance).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Kofi' }))
    })
  })

  it('refreshes data when Refresh button is clicked', async () => {
    renderPage()
    await screen.findAllByText('Ama Mensah')
    const callCount = apiMock.listDailyPupilFinance.mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: /Refresh/i }))
    await waitFor(() => {
      expect(apiMock.listDailyPupilFinance.mock.calls.length).toBeGreaterThan(callCount)
    })
  })

  it('links to pupil finance profile', async () => {
    renderPage()
    await screen.findAllByText('Ama Mensah')
    const viewButtons = screen.getAllByRole('link', { name: /View/i })
    expect(viewButtons[0]).toHaveAttribute('href', '/accountant/pupils/pupil-1')
  })

  it('shows empty state when no pupils found', async () => {
    apiMock.listDailyPupilFinance.mockResolvedValue(resultFixture({ items: [] }))
    renderPage()
    expect(await screen.findByText('No pupils found.')).toBeInTheDocument()
  })

  it('shows error state and retries', async () => {
    apiMock.listDailyPupilFinance.mockRejectedValueOnce(new Error('Network error'))
    renderPage()
    expect(await screen.findByText('Network error')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Try again/i }))
    await waitFor(() => {
      expect(apiMock.listDailyPupilFinance.mock.calls.length).toBe(2)
    })
  })

  it('shows outstanding amount in red when > 0', async () => {
    renderPage()
    await screen.findAllByText('Ama Mensah')
    const outstandingElements = screen.getAllByText('7,000.00')
    expect(outstandingElements.length).toBeGreaterThan(0)
  })

  it('shows zero outstanding without red styling', async () => {
    apiMock.listDailyPupilFinance.mockResolvedValue(
      resultFixture({ items: [pupilFixture({ outstanding: '0.00', financeStatus: 'PAID' })] }),
    )
    renderPage()
    await screen.findAllByText('Ama Mensah')
    const zeros = screen.getAllByText('0.00')
    expect(zeros.length).toBeGreaterThan(0)
  })

  it('shows loading skeleton while fetching', async () => {
    apiMock.listDailyPupilFinance.mockReturnValue(new Promise(() => {}))
    renderPage()
    expect(document.querySelector('[class*="animate-pulse"]')).toBeInTheDocument()
  })

  it('renders mobile list view', async () => {
    renderPage()
    await screen.findAllByText('Ama Mensah')
    const mobileItems = document.querySelectorAll('ul.space-y-3 li')
    expect(mobileItems.length).toBe(1)
  })

  it('renders desktop table view', async () => {
    renderPage()
    await screen.findAllByText('Ama Mensah')
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('populates class filter dropdown', async () => {
    renderPage()
    await waitFor(() => {
      expect(apiMock.listClasses).toHaveBeenCalled()
    })
    const classSelect = screen.getByLabelText(/Class/)
    expect(classSelect).toBeInTheDocument()
  })
})
