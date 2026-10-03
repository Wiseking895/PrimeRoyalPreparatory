import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'

/**
 * Rate-limit coverage for the credential-guessing channel that is
 * `POST /change-password`: every attempt verifies the account's current
 * password, so it must be throttled like a sign-in attempt.
 *
 * The budget is per app instance (in-memory store), so these tests own their
 * own `createApp()` and are unaffected by other test files.
 */

const verifyTokenMock = vi.hoisted(() => vi.fn())
const verifyTokenForKindMock = vi.hoisted(() => vi.fn())
const verifyPasswordMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  guardian: { findUnique: vi.fn(), update: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('../lib/jwt', () => ({
  signToken: vi.fn(),
  signImpersonationToken: vi.fn(),
  verifyToken: verifyTokenMock,
  verifyTokenPayload: verifyTokenMock,
  verifyTokenForKind: verifyTokenForKindMock,
}))
vi.mock('../lib/password', () => ({ verifyPassword: verifyPasswordMock, hashPassword: vi.fn() }))
vi.mock('../services/audit.service', () => ({ recordAudit: vi.fn() }))
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

const app = createApp()

function staffUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    fullName: 'Grace Hopper',
    email: 'grace@school.edu',
    phone: null,
    profilePictureUrl: null,
    passwordHash: '$2b$12$hashed',
    status: 'ACTIVE',
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    staffProfile: null,
    roles: [],
    ...overrides,
  }
}

function guardianRow() {
  return {
    id: 'guardian-1',
    fullName: 'Mrs. Efua Asante',
    email: 'efua@example.com',
    phone: '0244000000',
    passwordHash: '$2b$12$hashed',
    status: 'ACTIVE',
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  }
}

const STAFF_PAYLOAD = { currentPassword: 'wrong-pass-1', newPassword: 'Newpass123' }
const PARENT_PAYLOAD = { currentPassword: 'wrong-pass-1', newPassword: 'Newpass123' }

describe('password-change rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockReturnValue({ sub: 'user-1', kind: 'staff' })
    verifyTokenForKindMock.mockReturnValue('guardian-1')
    // Every attempt guesses the wrong current password: fast, no writes.
    verifyPasswordMock.mockResolvedValue(false)
    prismaMock.user.findUnique.mockResolvedValue(staffUser())
    prismaMock.user.update.mockResolvedValue(staffUser())
    prismaMock.guardian.findUnique.mockResolvedValue(guardianRow())
    prismaMock.guardian.update.mockResolvedValue(guardianRow())
    prismaMock.auditLog.create.mockResolvedValue({})
  })

  it('throttles POST /api/auth/change-password after the budget is exhausted', async () => {
    const first = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', 'Bearer test-session-token')
      .send(STAFF_PAYLOAD)
    expect(first.status).toBe(400)

    for (let attempt = 2; attempt <= 15; attempt += 1) {
      const res = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', 'Bearer test-session-token')
        .send(STAFF_PAYLOAD)
      expect(res.status).toBe(400)
    }

    const blocked = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', 'Bearer test-session-token')
      .send(STAFF_PAYLOAD)
    expect(blocked.status).toBe(429)
    expect(String(blocked.body.message)).toMatch(/password change attempts/i)
  })

  it('throttles POST /api/parent/change-password after the budget is exhausted', async () => {
    const first = await request(app)
      .post('/api/parent/change-password')
      .set('Authorization', 'Bearer test-session-token')
      .send(PARENT_PAYLOAD)
    expect(first.status).toBe(400)

    for (let attempt = 2; attempt <= 15; attempt += 1) {
      const res = await request(app)
        .post('/api/parent/change-password')
        .set('Authorization', 'Bearer test-session-token')
        .send(PARENT_PAYLOAD)
      expect(res.status).toBe(400)
    }

    const blocked = await request(app)
      .post('/api/parent/change-password')
      .set('Authorization', 'Bearer test-session-token')
      .send(PARENT_PAYLOAD)
    expect(blocked.status).toBe(429)
    expect(String(blocked.body.message)).toMatch(/password change attempts/i)
  })
})
