import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DashboardLayout } from './DashboardLayout'

let ROLES: string[] = []

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'user-1',
      fullName: 'Test User',
      email: 'test@school.edu',
      phone: null,
      profilePictureUrl: null,
      status: 'ACTIVE',
      lastLoginAt: null,
      mustChangePassword: false,
      createdAt: '2026-01-01T00:00:00.000Z',
      staffId: 'PRPS-001',
      category: 'FINANCE',
      position: null,
      roles: ROLES,
      permissions: [],
    },
    hasPermission: () => true,
    logout: vi.fn(),
    isImpersonating: false,
    actingUser: null,
    developerUser: null,
  }),
}))

vi.mock('@/components/dashboard/NotificationBell', () => ({
  NotificationBell: () => null,
}))

vi.mock('@/components/dashboard/DeveloperModeBanner', () => ({
  DeveloperModeBanner: () => null,
}))

function renderLayout() {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="*" element={<DashboardLayout />}>
          <Route index element={<div>page content</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  )
}

function financeGroupLabels(): string[] {
  const nav = screen.getAllByRole('navigation', { name: 'Dashboard navigation' })[0]
  const label = Array.from(nav.querySelectorAll('p')).find((p) => p.textContent === 'Finance')
  const group = label?.parentElement
  if (!group) return []
  return Array.from(group.querySelectorAll('a')).map((a) => a.textContent?.trim() ?? '')
}

function academicGroupLabels(): string[] {
  const nav = screen.getAllByRole('navigation', { name: 'Dashboard navigation' })[0]
  const label = Array.from(nav.querySelectorAll('p')).find((p) => p.textContent === 'Academic')
  const group = label?.parentElement
  if (!group) return []
  return Array.from(group.querySelectorAll('a')).map((a) => a.textContent?.trim() ?? '')
}

describe('DashboardLayout Finance nav', () => {
  beforeEach(() => {
    ROLES = []
  })

  it('keeps the Session/Term navigation item hidden on the Finance Account', () => {
    ROLES = ['ACCOUNTANT']
    renderLayout()

    expect(financeGroupLabels()).toEqual([
      'Fee Structures',
      'Reconciliation',
      'Payment History',
    ])
    expect(screen.queryByRole('link', { name: 'Academic Years & Terms' })).not.toBeInTheDocument()
    const dashboardLink = screen.getAllByRole('link', { name: /Dashboard/i })[0]
    expect(dashboardLink).toHaveAttribute('href', '/accountant/dashboard')
  })

  it('exposes Academic Years & Terms to the headteacher', () => {
    ROLES = ['HEADTEACHER']
    renderLayout()

    expect(academicGroupLabels()).toContain('Academic Years & Terms')
    expect(screen.getAllByRole('link', { name: 'Academic Years & Terms' })[0]).toHaveAttribute(
      'href',
      '/headteacher/finance/sessions',
    )
  })

  it('orders headteacher Finance nav with Fee Structures before Reconciliation and Payment History', () => {
    ROLES = ['HEADTEACHER']
    renderLayout()

    expect(financeGroupLabels()).toEqual([
      'Finance',
      'Fee Structures',
      'Reconciliation',
      'Payment History',
    ])
    expect(screen.getAllByRole('link', { name: 'Fee Structures' })[0]).toHaveAttribute(
      'href',
      '/headteacher/finance/fees',
    )
  })

  it('orders owner Finance nav as overview, Reconciliation, Payment History', () => {
    ROLES = ['OWNER']
    renderLayout()

    expect(financeGroupLabels()).toEqual([
      'Finance Overview',
      'Reconciliation',
      'Payment History',
    ])
  })
})
