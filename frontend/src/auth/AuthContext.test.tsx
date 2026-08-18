import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { AuthProvider, useAuth } from './AuthContext'
import type { PublicUser } from '@/types/portal'

const { meMock, loginMock, setUnauthorizedHandlerMock } = vi.hoisted(() => ({
  meMock: vi.fn(),
  loginMock: vi.fn(),
  setUnauthorizedHandlerMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: { me: meMock, login: loginMock },
  setUnauthorizedHandler: setUnauthorizedHandlerMock,
}))

const ownerUser: PublicUser = {
  id: 'owner-1',
  fullName: 'Ada Lovelace',
  email: 'owner@school.edu',
  phone: null,
  profilePictureUrl: null,
  status: 'ACTIVE',
  lastLoginAt: null,
  mustChangePassword: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  staffId: null,
  roles: ['OWNER'],
  permissions: ['owner.manage'],
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    setUnauthorizedHandlerMock.mockImplementation(() => undefined)
    meMock.mockResolvedValue(ownerUser)
    loginMock.mockResolvedValue({ token: 'new-token', user: ownerUser })
  })

  it('restores an authenticated session and clears it on logout', async () => {
    localStorage.setItem('prps.portal.token', 'signed-token')
    localStorage.setItem('prps.portal.user', JSON.stringify(ownerUser))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('authenticated'))
    expect(result.current.user?.email).toBe('owner@school.edu')

    act(() => result.current.logout())

    expect(result.current.status).toBe('unauthenticated')
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('prps.portal.token')).toBeNull()
    expect(localStorage.getItem('prps.portal.user')).toBeNull()
  })

  it('stores the token and user when sign in succeeds', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper })

    const signedIn = await act(async () =>
      result.current.login('owner@school.edu', 'OwnerPass123'),
    )

    expect(signedIn?.roles).toContain('OWNER')
    expect(result.current.status).toBe('authenticated')
    expect(loginMock).toHaveBeenCalledWith('owner@school.edu', 'OwnerPass123')
    expect(localStorage.getItem('prps.portal.token')).toBe('new-token')
    expect(localStorage.getItem('prps.portal.user')).toContain('OWNER')
  })

  it('clears a stale session when the profile can no longer be fetched', async () => {
    localStorage.setItem('prps.portal.token', 'expired-token')
    localStorage.setItem('prps.portal.user', JSON.stringify(ownerUser))
    meMock.mockRejectedValue(new Error('Invalid or expired session.'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => expect(result.current.status).toBe('unauthenticated'))
    expect(result.current.user).toBeNull()
    expect(localStorage.getItem('prps.portal.token')).toBeNull()
    expect(localStorage.getItem('prps.portal.user')).toBeNull()
  })
})