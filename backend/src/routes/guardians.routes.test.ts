import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'

const verifyTokenMock = vi.hoisted(() => vi.fn())
const hashPasswordMock = vi.hoisted(() => vi.fn())
const generateTemporaryPasswordMock = vi.hoisted(() => vi.fn())
const sendGuardianInvitationMock = vi.hoisted(() => vi.fn())
const maskEmailMock = vi.hoisted(() => vi.fn(() => 'e***@example.com'))
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  guardian: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn() },
}))

vi.mock('../lib/jwt', () => ({ verifyToken: verifyTokenMock }))
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../lib/password', () => ({ hashPassword: hashPasswordMock, verifyPassword: vi.fn() }))
vi.mock('../lib/temporary-password', () => ({ generateTemporaryPassword: generateTemporaryPasswordMock }))
vi.mock('../services/mail.service', () => ({
  sendGuardianInvitation: sendGuardianInvitationMock,
  maskEmail: maskEmailMock,
}))
vi.mock('../services/audit.service', () => ({ recordAudit: vi.fn() }))

const app = createApp()

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    fullName: 'Ama Mensah',
    email: 'ama@school.edu',
    phone: null,
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: null,
    mustChangePassword: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    staffProfile: { staffId: 'STF-0001' },
    roles: [
      {
        role: {
          id: 'role-headteacher',
          name: 'HEADTEACHER',
          rolePermissions: [
            { permission: { key: 'guardians.view' } },
            { permission: { key: 'guardians.manage' } },
            { permission: { key: 'sba.view' } },
          ],
        },
      },
    ],
    ...overrides,
  }
}

function guardianRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guardian-1',
    fullName: 'Mrs. Efua Asante',
    email: 'efua@example.com',
    accountEmail: 'efua@example.com',
    phone: '0244000000',
    passwordHash: null,
    status: 'INACTIVE',
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    _count: { pupilGuardians: 2 },
    ...overrides,
  }
}

const auth = 'Bearer staff-token'

describe('guardians.routes (Phase 7 — Parent Account administration)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockReturnValue('user-1')
    prismaMock.user.findUnique.mockResolvedValue(userRow())
    hashPasswordMock.mockResolvedValue('$2b$12$hash')
    generateTemporaryPasswordMock.mockReturnValue('TEMP1234abcd')
    sendGuardianInvitationMock.mockResolvedValue({ status: 'dev', transport: 'dev' })
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.guardian.findMany.mockResolvedValue([guardianRow()])
    prismaMock.guardian.count.mockResolvedValue(1)
    prismaMock.guardian.findUnique.mockResolvedValue(guardianRow())
    prismaMock.guardian.update.mockResolvedValue(
      guardianRow({ passwordHash: '$2b$12$hash', status: 'ACTIVE', mustChangePassword: true }),
    )
  })

  describe('authz gating', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/guardians')
      expect(res.status).toBe(401)
    })

    it('forbids staff without the guardians.view permission', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        userRow({ roles: [{ role: { id: 'r', name: 'TEACHER', rolePermissions: [{ permission: { key: 'sba.view' } }] } }] }),
      )
      const res = await request(app).get('/api/guardians').set('Authorization', auth)
      expect(res.status).toBe(403)
    })

    it('forbids creating an account without the guardians.manage permission', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        userRow({ roles: [{ role: { id: 'r', name: 'TEACHER', rolePermissions: [{ permission: { key: 'guardians.view' } }] } }] }),
      )
      const res = await request(app).post('/api/guardians/guardian-1/parent-account').set('Authorization', auth).send({})
      expect(res.status).toBe(403)
      expect(generateTemporaryPasswordMock).not.toHaveBeenCalled()
    })
  })

  describe('GET /api/guardians', () => {
    it('lists guardians for an authorized staff member', async () => {
      const res = await request(app).get('/api/guardians?account=has_account').set('Authorization', auth)
      expect(res.status).toBe(200)
      expect(res.body.data.total).toBe(1)
      expect(res.body.data.items[0]).toMatchObject({ id: 'guardian-1', hasAccount: false })
    })
  })

  describe('POST /api/guardians/:id/parent-account', () => {
    it('provisions a parent account and sends the invitation', async () => {
      const res = await request(app)
        .post('/api/guardians/guardian-1/parent-account')
        .set('Authorization', auth)
        .send({ accountEmail: 'efua@example.com' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(sendGuardianInvitationMock).toHaveBeenCalledWith({
        to: 'efua@example.com',
        fullName: 'Mrs. Efua Asante',
        temporaryPassword: 'TEMP1234abcd',
      })
      const serialized = JSON.stringify(res.body)
      expect(serialized).not.toContain('TEMP1234abcd')
      expect(serialized).not.toContain('$2b$12$hash')
    })

    it('rejects a malformed account email with 400', async () => {
      const res = await request(app)
        .post('/api/guardians/guardian-1/parent-account')
        .set('Authorization', auth)
        .send({ accountEmail: 'not-an-email' })
      expect(res.status).toBe(422)
      expect(sendGuardianInvitationMock).not.toHaveBeenCalled()
    })
  })

  describe('POST /api/guardians/:id/parent-account/:action', () => {
    it('deactivates an active parent account', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(
        guardianRow({ passwordHash: '$2b$12$hash', status: 'ACTIVE' }),
      )
      prismaMock.guardian.update.mockResolvedValue(guardianRow({ passwordHash: '$2b$12$hash', status: 'INACTIVE' }))
      const res = await request(app)
        .post('/api/guardians/guardian-1/parent-account/deactivate')
        .set('Authorization', auth)
      expect(res.status).toBe(200)
      expect(prismaMock.guardian.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'INACTIVE' }) }),
      )
    })
  })
})