import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PupilFinancePage } from './PupilFinancePage'
import type { FinancePupilListResult, PupilBalanceView } from '@/types/portal'

const apiMock = vi.hoisted(() => ({
  listFinancePupils: vi.fn(),
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

function pupilFixture(overrides: Partial<PupilBalanceView> = {}): PupilBalanceView {
  return {
    id: 'pupil-1',
    pupilId: 'PRPS-P-0001',
    fullName: 'Ama Mensah',
    className: 'Primary 1',
    status: 'ACTIVE',
    totalDue: '150000.00',
    totalPaid: '50000.00',
    outstanding: '100000.00',
    chargeCount: 1,
    ...overrides,
  }
}

function resultFixture(overrides: Partial<FinancePupilListResult> = {}): FinancePupilListResult {
  return {
    items: [pupilFixture()],
    total: 1,
    page: 1,
    pageSize: 20,
    hasMore: false,
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
    apiMock.listFinancePupils.mockResolvedValue(resultFixture())
  })

  it('renders pupil finance balances', async () => {
    renderPage()

    expect((await screen.findAllByText('Ama Mensah')).length).toBeGreaterThan(0)
    expect(screen.getAllByText('PRPS-P-0001').length).toBeGreaterThan(0)
    expect(screen.getAllByText('100,000.00').length).toBeGreaterThan(0)
  })

  it('links to a pupil finance profile', async () => {
    renderPage()

    await screen.findAllByText('Ama Mensah')
    expect(screen.getByRole('link', { name: /View profile/i })).toHaveAttribute('href', '/accountant/pupils/pupil-1')
  })

  it('searches pupils by query', async () => {
    renderPage()

    await screen.findAllByText('Ama Mensah')
    fireEvent.change(screen.getByLabelText(/^Search pupils/), { target: { value: 'Ama' } })

    await waitFor(() => {
      expect(apiMock.listFinancePupils).toHaveBeenLastCalledWith(expect.objectContaining({ q: 'Ama', page: 1 }))
    })
  })

  it('shows an empty state when there are no pupils', async () => {
    apiMock.listFinancePupils.mockResolvedValue(resultFixture({ items: [], total: 0 }))
    renderPage()

    expect(await screen.findByText('No pupils found.')).toBeInTheDocument()
  })
})