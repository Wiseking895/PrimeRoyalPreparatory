import { Prisma } from '@prisma/client'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'

const verifyTokenMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  pupil: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
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
    count: vi.fn(),
  },
  teachingAssignment: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  classTeacher: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  auditLog: { create: vi.fn() },
}))

vi.mock('../lib/jwt', () => ({ verifyToken: verifyTokenMock }))
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../services/audit.service', () => ({ recordAudit: vi.fn() }))

const app = createApp()

function userWithKeys(keys: string[], roleName = 'HEADTEACHER', overrides: Record<string, unknown> = {}) {
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
    roles: [{ role: { id: 'r', name: roleName, rolePermissions: keys.map((key) => ({ permission: { key } })) } }],
    ...overrides,
  }
}

const HEADTEACHER = ['sba.view', 'sba.manage', 'reports.view']
const ACCOUNTANT = ['finance.view', 'finance.manage']
const TEACHER = ['sba.view']

function pupilRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    pupilId: 'PRPS-PUP-0001',
    firstName: 'Ama',
    lastName: 'Owusu',
    gender: 'FEMALE',
    status: 'ACTIVE',
    classId: 'cls-1',
    dateOfBirth: new Date('2015-01-01T00:00:00.000Z'),
    class: { id: 'cls-1', name: 'Class 1' },
    ...overrides,
  }
}

const auth = 'Bearer staff-token'

describe('reports.routes (Phase 7 — Terminal Reports API)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockReturnValue('user-1')
    prismaMock.user.findUnique.mockResolvedValue(userWithKeys(HEADTEACHER))
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.pupil.findMany.mockResolvedValue([pupilRow()])
    prismaMock.pupil.count.mockResolvedValue(1)
    prismaMock.pupil.findUnique.mockResolvedValue({ id: 'p-1', classId: 'cls-1' })
    prismaMock.sbaRecord.findMany.mockResolvedValue([])
    prismaMock.sbaRecord.count.mockResolvedValue(0)
    prismaMock.teachingAssignment.findFirst.mockResolvedValue(null)
    prismaMock.classTeacher.findFirst.mockResolvedValue(null)
    prismaMock.academicTerm.findMany.mockResolvedValue([])
    prismaMock.academicSession.findMany.mockResolvedValue([])
  })

  describe('authz gating', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const res = await request(app).get('/api/reports/pupils')
      expect(res.status).toBe(401)
    })

    it('forbids staff with neither reports.view nor sba.view (e.g. Accountant)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(userWithKeys(ACCOUNTANT))
      const res = await request(app).get('/api/reports/pupils').set('Authorization', auth)
      expect(res.status).toBe(403)
    })
  })

  describe('GET /api/reports/pupils', () => {
    it('lists pupils for an oversight role', async () => {
      const res = await request(app).get('/api/reports/pupils').set('Authorization', auth)
      expect(res.status).toBe(200)
      expect(res.body.data.items[0]).toMatchObject({ id: 'p-1', fullName: 'Ama Owusu' })
      expect(res.body.data.total).toBe(1)
    })

    it('scopes a teacher to their classes and recorded pupils', async () => {
      prismaMock.user.findUnique.mockResolvedValue(userWithKeys(TEACHER, 'TEACHER'))
      prismaMock.teachingAssignment.findMany.mockResolvedValue([{ classId: 'cls-1' }])
      prismaMock.classTeacher.findMany.mockResolvedValue([])
      prismaMock.sbaRecord.findMany.mockResolvedValue([{ pupilId: 'p-2' }])
      prismaMock.pupil.findMany.mockResolvedValue([pupilRow({ id: 'p-2', pupilId: 'PRPS-PUP-0002' })])
      const res = await request(app).get('/api/reports/pupils').set('Authorization', auth)
      expect(res.status).toBe(200)
      expect(res.body.data.items[0].id).toBe('p-2')
    })
  })

  describe('GET /api/reports/pupils/:pupilId/reports', () => {
    it('returns term options for an oversight role', async () => {
      prismaMock.pupil.findUnique.mockResolvedValue({ id: 'p-1', classId: 'cls-1' })
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
        .get('/api/reports/pupils/p-1/reports')
        .set('Authorization', auth)
      expect(res.status).toBe(200)
      expect(res.body.data[0].id).toBe('t-1')
    })

    it('forbids a teacher with no connection to the pupil', async () => {
      prismaMock.user.findUnique.mockResolvedValue(userWithKeys(TEACHER, 'TEACHER'))
      prismaMock.pupil.findUnique.mockResolvedValue({ id: 'p-1', classId: 'cls-1' })
      prismaMock.sbaRecord.findMany.mockResolvedValue([])
      const res = await request(app)
        .get('/api/reports/pupils/p-1/reports')
        .set('Authorization', auth)
      expect(res.status).toBe(403)
    })

    it('allows a teacher with an ACTIVE assignment in the recorded class', async () => {
      prismaMock.user.findUnique.mockResolvedValue(userWithKeys(TEACHER, 'TEACHER'))
      prismaMock.pupil.findUnique.mockResolvedValue({ id: 'p-1', classId: 'cls-1' })
      prismaMock.sbaRecord.findMany.mockResolvedValue([{ classId: 'cls-1', teacherId: 'user-1' }])
      prismaMock.teachingAssignment.findFirst.mockResolvedValue({ id: 'ta-1' })
      const res = await request(app)
        .get('/api/reports/pupils/p-1/reports')
        .set('Authorization', auth)
      expect(res.status).toBe(200)
    })
  })

  describe('GET /api/reports/pupils/:pupilId/reports/terms/:termId', () => {
    it('returns the computed report for an oversight role', async () => {
      prismaMock.pupil.findUnique.mockResolvedValue(pupilRow())
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
          comment: 'Excellent',
          subject: { id: 'sub-1', code: 'MATH', name: 'Mathematics' },
          class: { id: 'cls-1', name: 'Class 1' },
        },
      ])
      const res = await request(app)
        .get('/api/reports/pupils/p-1/reports/terms/t-1')
        .set('Authorization', auth)
      expect(res.status).toBe(200)
      expect(res.body.data.subjects[0]).toMatchObject({ subjectCode: 'MATH', grade: 'A', percentage: 85 })
    })
  })
})