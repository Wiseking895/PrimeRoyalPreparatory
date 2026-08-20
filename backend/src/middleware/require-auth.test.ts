import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'
import { requireAuth } from './require-auth'
import type { NextFunction, Request, Response } from 'express'

const verifyTokenMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}))

vi.mock('../lib/jwt', () => ({ verifyToken: verifyTokenMock }))
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    fullName: 'Grace Hopper',
    email: 'grace@school.edu',
    phone: null,
    profilePictureUrl: null,
    status: 'ACTIVE',
    mustChangePassword: false,
    staffProfile: null,
    roles: [],
    ...overrides,
  }
}

interface Outcome {
  nextCalled: boolean
  error?: unknown
  user?: unknown
}

function invoke(url: string, authHeader = 'Bearer token'): Promise<Outcome> {
  return new Promise((resolve) => {
    const req = { headers: { authorization: authHeader }, originalUrl: url } as unknown as Request
    const res = {} as Response
    const next = ((error?: unknown) => {
      if (error) resolve({ nextCalled: false, error })
      else resolve({ nextCalled: true })
    }) as unknown as NextFunction
    void requireAuth(req, res, next)
  })
}

describe('require-auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockReturnValue('user-1')
  })

  it('allows an account with a temporary password to reach the password-change endpoints', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [{ role: { name: 'HEADTEACHER', rolePermissions: [] } }], mustChangePassword: true }),
    )

    const outcome = await invoke('/api/auth/first-password-change')

    expect(outcome.nextCalled).toBe(true)
  })

  it('blocks a temporary-password account from normal dashboard endpoints', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [{ role: { name: 'HEADTEACHER', rolePermissions: [] } }], mustChangePassword: true }),
    )

    const outcome = await invoke('/api/owner/summary')

    expect(outcome.error).toMatchObject({
      statusCode: HttpStatus.Forbidden,
      message: expect.stringMatching(/set a new password/),
    })
  })

  it('passes through once the temporary password has been changed', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [{ role: { name: 'HEADTEACHER', rolePermissions: [{ permission: { key: 'staff.view' } }] } }] }),
    )

    const outcome = await invoke('/api/staff')

    expect(outcome.nextCalled).toBe(true)
  })

  it('rejects a missing bearer token', async () => {
    const outcome = await invoke('/api/owner/summary', '')

    expect(outcome.error).toMatchObject({ statusCode: HttpStatus.Unauthorized })
  })

  it('blocks a deactivated account from every protected endpoint with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ status: 'INACTIVE', roles: [{ role: { name: 'SUBJECT_TEACHER', rolePermissions: [] } }] }),
    )

    const outcome = await invoke('/api/sba')

    expect(outcome.error).toMatchObject({
      statusCode: HttpStatus.Forbidden,
      message: expect.stringMatching(/deactivated/),
    })
  })

  it('resolves permissions fresh from the database on every request', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [{ role: { name: 'HEADTEACHER', rolePermissions: [{ permission: { key: 'sba.manage' } }] } }] }),
    )

    const outcome = await invoke('/api/sba/bulk')

    expect(outcome.nextCalled).toBe(true)
    expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(1)
  })
})