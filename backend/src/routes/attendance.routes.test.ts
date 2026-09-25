import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'

const verifyTokenMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn(), findUnique: vi.fn() },
  pupil: { findUnique: vi.fn(), findMany: vi.fn() },
  attendance: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  dailyReconciliationClose: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('../lib/jwt', () => ({ verifyToken: verifyTokenMock, verifyTokenPayload: verifyTokenMock }))
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

const app = createApp()

function baseUser(overrides: Record<string, unknown> = {}) {
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
    staffProfile: null,
    roles: [],
    ...overrides,
  }
}

function roleEntry(name: string, keys: string[]) {
  return {
    role: {
      id: `role-${name}`,
      name,
      rolePermissions: keys.map((key) => ({ permission: { key } })),
    },
  }
}

/**
 * The generic /api/attendance API must stay guarded by attendance.manage.
 * Finance permissions (payments.record / finance.view) must never unlock it —
 * Finance Reconciliation attendance has its own dedicated endpoint.
 */
describe('attendance routes (generic API stays protected)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockReturnValue({ sub: 'user-1', kind: 'staff' })
    prismaMock.user.findUnique.mockResolvedValue(baseUser())
    prismaMock.user.findMany.mockResolvedValue([])
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.dailyReconciliationClose.findUnique.mockResolvedValue(null)
    prismaMock.attendance.findFirst.mockResolvedValue(null)
    prismaMock.attendance.findUnique.mockResolvedValue(null)
    prismaMock.attendance.create.mockResolvedValue({
      id: 'att-1',
      pupilId: 'p-1',
      staffId: 'user-1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      status: 'PRESENT',
      sessionId: null,
      classId: null,
      notes: null,
      createdAt: new Date('2026-01-05T08:00:00.000Z'),
      updatedAt: new Date('2026-01-05T08:00:00.000Z'),
      pupil: { firstName: 'Ama', lastName: 'Mensah', pupilId: 'PRPS-P-001' },
      staff: { fullName: 'Ama Mensah' },
    })
    prismaMock.attendance.update.mockResolvedValue({
      id: 'att-1',
      pupilId: 'p-1',
      staffId: 'user-1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      status: 'ABSENT',
      sessionId: null,
      classId: null,
      notes: null,
      createdAt: new Date('2026-01-05T08:00:00.000Z'),
      updatedAt: new Date('2026-01-05T08:00:00.000Z'),
      pupil: { firstName: 'Ama', lastName: 'Mensah', pupilId: 'PRPS-P-001' },
      staff: { fullName: 'Ama Mensah' },
    })
    prismaMock.pupil.findUnique.mockResolvedValue({ id: 'p-1', pupilId: 'PRPS-P-001', status: 'ACTIVE' })
  })

  it('rejects unauthenticated POST /api/attendance with 401', async () => {
    const res = await request(app)
      .post('/api/attendance')
      .send({ pupilId: 'p-1', staffId: 'user-1', status: 'PRESENT', date: '2026-01-05' })
    expect(res.status).toBe(401)
  })

  it('rejects POST /api/attendance without attendance.manage with 403 (finance permissions do not unlock it)', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({
        roles: [
          roleEntry('ACCOUNTANT', ['finance.view', 'finance.manage', 'payments.record', 'attendance.view']),
        ],
      }),
    )

    const res = await request(app)
      .post('/api/attendance')
      .set('Authorization', 'Bearer token')
      .send({ pupilId: 'p-1', staffId: 'user-1', status: 'PRESENT', date: '2026-01-05' })
    expect(res.status).toBe(403)
    expect(prismaMock.attendance.create).not.toHaveBeenCalled()
  })

  it('rejects PATCH /api/attendance/:id without attendance.manage with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({
        roles: [
          roleEntry('ACCOUNTANT', ['finance.view', 'finance.manage', 'payments.record', 'attendance.view']),
        ],
      }),
    )

    const res = await request(app)
      .patch('/api/attendance/att-1')
      .set('Authorization', 'Bearer token')
      .send({ status: 'PRESENT' })
    expect(res.status).toBe(403)
    expect(prismaMock.attendance.update).not.toHaveBeenCalled()
  })

  it('still allows POST /api/attendance for a role holding attendance.manage', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['attendance.manage', 'attendance.view'])] }),
    )

    const res = await request(app)
      .post('/api/attendance')
      .set('Authorization', 'Bearer token')
      .send({ pupilId: 'p-1', staffId: 'user-1', status: 'PRESENT', date: '2026-01-05' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(prismaMock.attendance.create).toHaveBeenCalled()
  })

  it('still allows PATCH /api/attendance/:id for a role holding attendance.manage', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['attendance.manage', 'attendance.view'])] }),
    )
    prismaMock.attendance.findUnique.mockResolvedValue({
      id: 'att-1',
      pupilId: 'p-1',
      staffId: 'user-1',
      date: new Date('2026-01-05T00:00:00.000Z'),
      status: 'PRESENT',
      sessionId: null,
      classId: null,
      notes: null,
      createdAt: new Date('2026-01-05T08:00:00.000Z'),
      updatedAt: new Date('2026-01-05T08:00:00.000Z'),
    })

    const res = await request(app)
      .patch('/api/attendance/att-1')
      .set('Authorization', 'Bearer token')
      .send({ status: 'ABSENT' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(prismaMock.attendance.update).toHaveBeenCalled()
  })
})
