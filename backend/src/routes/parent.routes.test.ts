import { Prisma } from '@prisma/client'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'

const verifyTokenForKindMock = vi.hoisted(() => vi.fn())
const signTokenMock = vi.hoisted(() => vi.fn())
const verifyPasswordMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  guardian: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  pupilGuardian: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  pupil: {
    findUnique: vi.fn(),
  },
  academicTerm: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  academicSession: {
    findMany: vi.fn(),
  },
  sbaRecord: {
    findMany: vi.fn(),
  },
  financeFee: { findMany: vi.fn() },
  feeCharge: { findMany: vi.fn() },
  feeAssignment: { findMany: vi.fn() },
  payment: { findMany: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('../lib/jwt', () => ({ signToken: signTokenMock, verifyTokenForKind: verifyTokenForKindMock }))
vi.mock('../lib/password', () => ({ verifyPassword: verifyPasswordMock, hashPassword: vi.fn() }))
vi.mock('../services/audit.service', () => ({ recordAudit: vi.fn() }))
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

const app = createApp()

function guardianRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guardian-1',
    fullName: 'Mrs. Efua Asante',
    email: 'efua@example.com',
    accountEmail: 'efua@example.com',
    phone: '0244000000',
    passwordHash: '$2b$12$hashed',
    status: 'ACTIVE',
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    pupilGuardians: [{ pupilId: 'p-1' }, { pupilId: 'p-2' }],
    ...overrides,
  }
}

function childLink(overrides: Record<string, unknown> = {}) {
  return {
    pupilId: 'p-1',
    guardianId: 'guardian-1',
    relationship: 'Mother',
    isPrimary: true,
    isEmergency: true,
    pupil: {
      id: 'p-1',
      pupilId: 'PRPS-PUP-0001',
      firstName: 'Ama',
      lastName: 'Owusu',
      gender: 'FEMALE',
      status: 'ACTIVE',
      dateOfBirth: new Date('2015-01-01T00:00:00.000Z'),
      class: { id: 'cls-1', name: 'Class 1' },
    },
    ...overrides,
  }
}

describe('parent.routes (Phase 7 — Parent Portal API)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenForKindMock.mockReturnValue('guardian-1')
    signTokenMock.mockReturnValue('parent-token')
    verifyPasswordMock.mockResolvedValue(true)
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.guardian.findUnique.mockResolvedValue(guardianRow())
    prismaMock.guardian.update.mockResolvedValue(guardianRow())
    prismaMock.pupilGuardian.findUnique.mockResolvedValue({ pupilId: 'p-1' })
    prismaMock.pupilGuardian.findMany.mockResolvedValue([childLink()])
    prismaMock.pupil.findUnique.mockResolvedValue({
      id: 'p-1',
      pupilId: 'PRPS-PUP-0001',
      firstName: 'Ama',
      lastName: 'Owusu',
      classId: 'cls-1',
      class: { id: 'cls-1', name: 'Class 1' },
    })
    prismaMock.feeCharge.findMany.mockResolvedValue([])
    prismaMock.feeAssignment.findMany.mockResolvedValue([])
    prismaMock.payment.findMany.mockResolvedValue([])
    prismaMock.financeFee.findMany.mockResolvedValue([])
  })

  describe('POST /api/parent/login', () => {
    it('rejects an invalid body with 400', async () => {
      const res = await request(app).post('/api/parent/login').send({ identifier: '' })
      expect(res.status).toBe(422)
      expect(verifyPasswordMock).not.toHaveBeenCalled()
    })

    it('rejects unknown credentials with 401', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(null)
      const res = await request(app)
        .post('/api/parent/login')
        .send({ identifier: 'nobody@example.com', password: 'secret123' })
      expect(res.status).toBe(401)
      expect(signTokenMock).not.toHaveBeenCalled()
    })

    it('signs in a parent and returns a token with no secrets', async () => {
      const res = await request(app)
        .post('/api/parent/login')
        .send({ identifier: 'Efua@example.com', password: 'secret123' })
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.token).toBe('parent-token')
      expect(JSON.stringify(res.body)).not.toContain('$2b$12$hashed')
      expect(signTokenMock).toHaveBeenCalledWith('guardian-1', 'guardian')
    })
  })

  describe('requireParentAuth gate', () => {
    it('rejects a missing token with 401', async () => {
      const res = await request(app).get('/api/parent/me')
      expect(res.status).toBe(401)
    })

    it('rejects a staff token (kind mismatch) with 401', async () => {
      verifyTokenForKindMock.mockReturnValue(null)
      const res = await request(app).get('/api/parent/me').set('Authorization', 'Bearer staff-token')
      expect(res.status).toBe(401)
    })

    it('blocks portal browsing while a first-login password change is due', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow({ mustChangePassword: true }))
      const res = await request(app).get('/api/parent/children').set('Authorization', 'Bearer parent-token')
      expect(res.status).toBe(403)
    })

    it('still allows /me and /first-password-change during the first-login state', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow({ mustChangePassword: true }))
      const me = await request(app).get('/api/parent/me').set('Authorization', 'Bearer parent-token')
      expect(me.status).toBe(200)
      const change = await request(app)
        .post('/api/parent/first-password-change')
        .set('Authorization', 'Bearer parent-token')
        .send({ newPassword: 'NewPassword1', confirmPassword: 'NewPassword1' })
      expect(change.status).toBe(200)
    })

    it('rejects a deactivated parent account with 403', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow({ status: 'INACTIVE' }))
      const res = await request(app).get('/api/parent/children').set('Authorization', 'Bearer parent-token')
      expect(res.status).toBe(403)
    })
  })

  describe('GET /api/parent/children', () => {
    it('returns only the linked children', async () => {
      const res = await request(app).get('/api/parent/children').set('Authorization', 'Bearer parent-token')
      expect(res.status).toBe(200)
      expect(res.body.data).toHaveLength(1)
      expect(res.body.data[0]).toMatchObject({ id: 'p-1', fullName: 'Ama Owusu' })
    })
  })

  describe('GET /api/parent/children/:pupilId/finance', () => {
    it('blocks an unlinked pupil with 403 (no finance query leaks)', async () => {
      prismaMock.pupilGuardian.findUnique.mockResolvedValue(null)
      const res = await request(app)
        .get('/api/parent/children/p-999/finance')
        .set('Authorization', 'Bearer parent-token')
      expect(res.status).toBe(403)
      expect(prismaMock.feeCharge.findMany).not.toHaveBeenCalled()
    })

    it('returns finance for a linked pupil', async () => {
      const res = await request(app)
        .get('/api/parent/children/p-1/finance')
        .set('Authorization', 'Bearer parent-token')
      expect(res.status).toBe(200)
      expect(res.body.data.pupil.fullName).toBe('Ama Owusu')
    })
  })

  describe('GET /api/parent/children/:pupilId/reports', () => {
    it('returns term options for a linked pupil', async () => {
      prismaMock.academicTerm.findMany.mockResolvedValue([
        {
          id: 't-1',
          name: 'First Term',
          termNumber: 1,
          sessionId: 's-1',
          session: { id: 's-1', name: '2025/2026 Academic Year' },
          _count: { sbaRecords: 0 },
        },
      ])
      const res = await request(app)
        .get('/api/parent/children/p-1/reports')
        .set('Authorization', 'Bearer parent-token')
      expect(res.status).toBe(200)
      expect(res.body.data[0]).toMatchObject({ id: 't-1', hasReport: false })
    })
  })

  describe('GET /api/parent/children/:pupilId/reports/terms/:termId', () => {
    it('returns the computed report for a linked pupil', async () => {
      prismaMock.academicTerm.findUnique.mockResolvedValue({
        id: 't-1',
        name: 'First Term',
        termNumber: 1,
        session: { id: 's-1', name: '2025/2026 Academic Year' },
      })
      prismaMock.sbaRecord.findMany.mockResolvedValue([
        {
          id: 'rec-1',
          pupilId: 'p-1',
          subjectId: 'sub-1',
          classId: 'cls-1',
          termId: 't-1',
          score: new Prisma.Decimal('85.00'),
          maxScore: new Prisma.Decimal('100.00'),
          comment: null,
          subject: { id: 'sub-1', code: 'MATH', name: 'Mathematics' },
          class: { id: 'cls-1', name: 'Class 1' },
        },
      ])
      const res = await request(app)
        .get('/api/parent/children/p-1/reports/terms/t-1')
        .set('Authorization', 'Bearer parent-token')
      expect(res.status).toBe(200)
      expect(res.body.data.subjects[0].subjectCode).toBe('MATH')
    })
  })
})