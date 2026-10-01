import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider } from '@/auth/AuthContext'
import { OwnerSetupGate } from '@/auth/OwnerSetupGate'
import { saveSession } from '@/auth/storage'
import type { PublicUser } from '@/types/portal'

const { setupStatusMock, meMock } = vi.hoisted(() => ({
  setupStatusMock: vi.fn(),
  meMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: {
    setupStatus: setupStatusMock,
    me: meMock,
  },
  setUnauthorizedHandler: vi.fn(),
}))

const OWNER_USER: PublicUser = {
  id: 'owner-1',
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
  roles: ['OWNER'],
  permissions: ['owner.manage'],
}

function renderGate() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={['/owner/dashboard']}>
        <Routes>
          <Route
            path="/owner/dashboard"
            element={
              <OwnerSetupGate>
                <div>Owner area</div>
              </OwnerSetupGate>
            }
          />
          <Route path="/setup/owner" element={<div>Owner setup</div>} />
          <Route path="/login" element={<div>Staff sign in</div>} />
        </Routes>
      </MemoryRouter>
    </AuthProvider>,
  )
}

describe('OwnerSetupGate', () => {
  beforeEach(() => {
    localStorage.clear()
    setupStatusMock.mockReset()
    meMock.mockReset()
    setupStatusMock.mockResolvedValue({ ownerExists: true, googleOAuthEnabled: false })
  })

  it('sends an unauthenticated visitor to onboarding while no Owner exists', async () => {
    setupStatusMock.mockResolvedValue({ ownerExists: false, googleOAuthEnabled: false })
    renderGate()

    expect(await screen.findByText('Owner setup')).toBeInTheDocument()
    expect(screen.queryByText('Staff sign in')).not.toBeInTheDocument()
    // The Owner dashboard is never handed to an unauthenticated visitor.
    expect(screen.queryByText('Owner area')).not.toBeInTheDocument()
  })

  it('sends an unauthenticated visitor to sign-in once an Owner exists', async () => {
    renderGate()

    expect(await screen.findByText('Staff sign in')).toBeInTheDocument()
  })

  it('surfaces the failed setup check instead of silently bouncing to sign-in', async () => {
    setupStatusMock.mockRejectedValueOnce(new Error('offline'))
    setupStatusMock.mockResolvedValueOnce({ ownerExists: false, googleOAuthEnabled: false })
    renderGate()

    expect(await screen.findByText('We could not reach the server')).toBeInTheDocument()
    expect(screen.queryByText('Staff sign in')).not.toBeInTheDocument()
    expect(screen.queryByText('Owner setup')).not.toBeInTheDocument()

    // Retrying re-runs the check and then follows the first-owner decision.
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText('Owner setup')).toBeInTheDocument()
  })

  it('offers an explicit way to sign in when the check keeps failing', async () => {
    setupStatusMock.mockRejectedValue(new Error('offline'))
    renderGate()

    expect(await screen.findByRole('link', { name: /go to staff sign in/i })).toHaveAttribute(
      'href',
      '/login',
    )
    expect(screen.queryByText('Owner area')).not.toBeInTheDocument()
  })

  it('lets a signed-in Owner into the Owner area', async () => {
    saveSession('owner-token', OWNER_USER)
    meMock.mockResolvedValue(OWNER_USER)
    renderGate()

    expect(await screen.findByText('Owner area')).toBeInTheDocument()
    expect(setupStatusMock).not.toHaveBeenCalled()
  })
})
