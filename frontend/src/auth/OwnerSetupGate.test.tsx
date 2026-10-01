import { render, screen } from '@testing-library/react'
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
  })

  it('sends an unauthenticated visitor to sign-in once an Owner exists', async () => {
    renderGate()

    expect(await screen.findByText('Staff sign in')).toBeInTheDocument()
  })

  it('falls back to sign-in when the setup status cannot be checked', async () => {
    setupStatusMock.mockRejectedValue(new Error('offline'))
    renderGate()

    expect(await screen.findByText('Staff sign in')).toBeInTheDocument()
  })

  it('lets a signed-in Owner into the Owner area', async () => {
    saveSession('owner-token', OWNER_USER)
    meMock.mockResolvedValue(OWNER_USER)
    renderGate()

    expect(await screen.findByText('Owner area')).toBeInTheDocument()
    expect(setupStatusMock).not.toHaveBeenCalled()
  })
})
