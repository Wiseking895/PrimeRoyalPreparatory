import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ProtectedRoute } from './ProtectedRoute'
import { HEADTEACHER_ROLE, OWNER_ROLE } from './roles'
import type { PublicUser } from '@/types/portal'

interface AuthValue {
  user: PublicUser | null
  status: 'loading' | 'authenticated' | 'unauthenticated'
  isOwner: boolean
  isHeadteacher: boolean
  hasPermission: (key: string) => boolean
  login: (identifier: string, password: string) => Promise<PublicUser>
  logout: () => void
}

const { authState } = vi.hoisted(() => ({
  authState: { value: null as AuthValue | null },
}))

vi.mock('@/auth/AuthContext', () => ({
  useAuth: () => authState.value,
  AuthContext: undefined,
}))

function user(roles: string[]): PublicUser {
  return {
    id: 'user-1',
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: null,
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: null,
    mustChangePassword: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    staffId: null,
    category: null,
    position: null,
    roles,
    permissions: [],
  }
}

function buildAuth(status: 'loading' | 'authenticated' | 'unauthenticated', currentUser: PublicUser | null): AuthValue {
  return {
    user: currentUser,
    status,
    isOwner: currentUser?.roles.includes(OWNER_ROLE) ?? false,
    isHeadteacher: currentUser?.roles.includes(HEADTEACHER_ROLE) ?? false,
    hasPermission: () => false,
    login: async () => currentUser as PublicUser,
    logout: () => undefined,
  }
}

function renderWithStatus(status: 'loading' | 'authenticated' | 'unauthenticated', currentUser: PublicUser | null) {
  authState.value = buildAuth(status, currentUser)
  return render(
    <MemoryRouter initialEntries={['/owner/dashboard']}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login page</div>} />
        <Route
          path="/owner/dashboard"
          element={
            <ProtectedRoute roles={[OWNER_ROLE]}>
              <div data-testid="owner-dashboard">Owner dashboard</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

function renderHeadteacherRoute(status: 'authenticated', currentUser: PublicUser) {
  authState.value = buildAuth(status, currentUser)
  return render(
    <MemoryRouter initialEntries={['/headteacher/dashboard']}>
      <Routes>
        <Route path="/login" element={<div data-testid="login-page">Login page</div>} />
        <Route
          path="/headteacher/dashboard"
          element={
            <ProtectedRoute roles={[HEADTEACHER_ROLE]}>
              <div data-testid="headteacher-dashboard">Headteacher dashboard</div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </MemoryRouter>,
  )
}

describe('ProtectedRoute', () => {
  it('shows a full-page loader while authentication status resolves', () => {
    renderWithStatus('loading', null)

    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.queryByTestId('login-page')).toBeNull()
    expect(screen.queryByTestId('owner-dashboard')).toBeNull()
  })

  it('redirects unauthenticated users to the login page', () => {
    renderWithStatus('unauthenticated', null)

    expect(screen.getByTestId('login-page')).toBeInTheDocument()
  })

  it('renders children for a user with the required role', () => {
    renderWithStatus('authenticated', user([OWNER_ROLE]))

    expect(screen.getByTestId('owner-dashboard')).toBeInTheDocument()
  })

  it('shows the forbidden screen when the user lacks the required role', () => {
    renderWithStatus('authenticated', user([HEADTEACHER_ROLE]))

    expect(screen.getByText(/don.t have access/i)).toBeInTheDocument()
  })

  it('lets a Headteacher access a route guarded for the Headteacher role', () => {
    renderHeadteacherRoute('authenticated', user([HEADTEACHER_ROLE]))

    expect(screen.getByTestId('headteacher-dashboard')).toBeInTheDocument()
  })

  it('blocks an Owner from a route guarded for the Headteacher role', () => {
    renderHeadteacherRoute('authenticated', user([OWNER_ROLE]))

    expect(screen.getByText(/don.t have access/i)).toBeInTheDocument()
    expect(screen.queryByTestId('headteacher-dashboard')).toBeNull()
  })
})