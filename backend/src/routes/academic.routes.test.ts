import { Prisma } from '@prisma/client'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'

const verifyTokenMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  subject: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    groupBy: vi.fn(),
  },
  schoolClass: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  academicTerm: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  teachingAssignment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    groupBy: vi.fn(),
  },
  classTeacher: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    count: vi.fn(),
  },
  sbaRecord: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  pupil: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../lib/jwt', () => ({ verifyToken: verifyTokenMock }))
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

const HEADTEACHER_ROLES = [
  'academic.view',
  'academic.manage',
  'teachers.view',
  'teachers.manage',
  'subjects.view',
  'subjects.manage',
  'assignments.manage',
  'sba.view',
  'sba.manage',
]

function subjectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sub-1',
    code: 'MATH',
    name: 'Mathematics',
    description: null,
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    _count: { assignments: 0 },
    ...overrides,
  }
}

function staffUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-2',
    fullName: 'Kofi Mensah',
    email: 'kofi@school.edu',
    phone: null,
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: null,
    mustChangePassword: false,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    staffProfile: { staffId: 'STF-0002', position: 'CLASS_TEACHER', category: 'TEACHING' },
    roles: [],
    ...overrides,
  }
}

function klassRow() {
  return { id: 'cls-1', name: 'Class 1', status: 'ACTIVE' }
}

function assignmentRow() {
  return {
    id: 'ta-1',
    teacherId: 'user-2',
    subjectId: 'sub-1',
    classId: 'cls-1',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    teacher: { id: 'user-2', fullName: 'Kofi Mensah' },
    subject: { id: 'sub-1', code: 'MATH', name: 'Mathematics' },
    class: { id: 'cls-1', name: 'Class 1', _count: { pupils: 20 } },
  }
}

function sbaRecordRow() {
  return {
    id: 'rec-1',
    pupilId: 'p-1',
    subjectId: 'sub-1',
    classId: 'cls-1',
    termId: 't-1',
    teacherId: 'user-1',
    score: new Prisma.Decimal('85.50'),
    maxScore: new Prisma.Decimal('100.00'),
    comment: null,
    createdAt: new Date('2026-01-10T00:00:00.000Z'),
    updatedAt: new Date('2026-01-10T00:00:00.000Z'),
    pupil: { id: 'p-1', pupilId: 'PRPS-PUP-0001', firstName: 'Ama', lastName: 'Owusu', status: 'ACTIVE' },
    subject: { id: 'sub-1', code: 'MATH', name: 'Mathematics' },
    class: { id: 'cls-1', name: 'Class 1' },
    term: { id: 't-1', name: 'First Term', termNumber: 1, session: { id: 's-1', name: '2025/2026 Academic Year' } },
    teacher: { id: 'user-1', fullName: 'Ama Mensah' },
  }
}

describe('academic routes (Phase 6 — auth + RBAC enforcement)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockReturnValue('user-1')
    prismaMock.user.findUnique.mockResolvedValue(baseUser({ roles: [roleEntry('HEADTEACHER', HEADTEACHER_ROLES)] }))
    prismaMock.user.findMany.mockResolvedValue([])
    prismaMock.subject.findMany.mockResolvedValue([])
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.sbaRecord.groupBy.mockResolvedValue([])
    prismaMock.sbaRecord.count.mockResolvedValue(0)
    prismaMock.$transaction.mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') return arg(prismaMock)
      return Promise.resolve(arg)
    })
  })

  // ----- Subjects -----------------------------------------------------------

  it('rejects unauthenticated access to subjects with 401', async () => {
    const res = await request(app).get('/api/subjects')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('rejects unauthenticated access to every Phase 6 resource with 401', async () => {
    const unauthenticated = [
      request(app).get('/api/academic/teachers'),
      request(app).get('/api/academic/assignments'),
      request(app).get('/api/academic/classes/cls-1/class-teacher'),
      request(app).get('/api/sba'),
      request(app).get('/api/sba/rec-1'),
      request(app).post('/api/sba/bulk').send({}),
      request(app).post('/api/academic/assignments').send({}),
    ]
    for (const attempt of unauthenticated) {
      const res = await attempt
      expect(res.status).toBe(401)
    }
  })

  it('rejects a user without subjects.view from listing subjects with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser({ roles: [roleEntry('CLASS_TEACHER', ['academic.view'])] }))
    const res = await request(app).get('/api/subjects').set('Authorization', 'Bearer token')
    expect(res.status).toBe(403)
    expect(prismaMock.subject.findMany).not.toHaveBeenCalled()
  })

  it('allows listing subjects for a user with subjects.view', async () => {
    prismaMock.subject.findMany.mockResolvedValue([subjectRow()])
    const res = await request(app).get('/api/subjects').set('Authorization', 'Bearer token')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toHaveLength(1)
  })

  it('allows a HEADTEACHER to create a subject (201)', async () => {
    prismaMock.subject.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.id === 'sub-1' ? subjectRow() : null,
    )
    prismaMock.subject.create.mockResolvedValue(subjectRow())

    const res = await request(app)
      .post('/api/subjects')
      .set('Authorization', 'Bearer token')
      .send({ code: 'math', name: 'Mathematics' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.code).toBe('MATH')
    expect(prismaMock.auditLog.create).toHaveBeenCalled()
  })

  it('returns 409 for a duplicate subject code', async () => {
    prismaMock.subject.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.code === 'MATH' ? subjectRow() : null,
    )
    const res = await request(app)
      .post('/api/subjects')
      .set('Authorization', 'Bearer token')
      .send({ code: 'MATH', name: 'Mathematics' })
    expect(res.status).toBe(409)
    expect(res.body.message).toContain('code already exists')
  })

  it('rejects a user without subjects.manage from deactivating a subject with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ASSISTANT_HEADTEACHER', ['subjects.view'])] }),
    )
    const res = await request(app)
      .post('/api/subjects/sub-1/deactivate')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(403)
  })

  // ----- Teachers -----------------------------------------------------------

  it('rejects a user without teachers.view from listing teachers with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser({ roles: [roleEntry('ACCOUNTANT', ['finance.view'])] }))
    const res = await request(app).get('/api/academic/teachers').set('Authorization', 'Bearer token')
    expect(res.status).toBe(403)
    expect(prismaMock.user.findMany).not.toHaveBeenCalled()
  })

  it('allows listing teachers for a user with teachers.view', async () => {
    prismaMock.user.findMany.mockResolvedValue([
      {
        id: 'user-2',
        fullName: 'Kofi Mensah',
        email: 'kofi@school.edu',
        phone: null,
        status: 'ACTIVE',
        staffProfile: { staffId: 'STF-0002', position: 'CLASS_TEACHER', category: 'TEACHING' },
        roles: [{ role: { name: 'CLASS_TEACHER' } }],
        _count: { teachingAssignments: 2, classTeachers: 1, sbaRecords: 5 },
      },
    ])
    const res = await request(app).get('/api/academic/teachers').set('Authorization', 'Bearer token')
    expect(res.status).toBe(200)
    expect(res.body.data).toHaveLength(1)
    expect(res.body.data[0].positionLabel).toBeTruthy()
  })

  it('does not expose passwordHash or other secrets in the teacher detail response', async () => {
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-2',
      fullName: 'Kofi Mensah',
      email: 'kofi@school.edu',
      phone: null,
      passwordHash: '$2b$12$hashedcredentialmaterial',
      status: 'ACTIVE',
      staffProfile: { staffId: 'STF-0002', position: 'CLASS_TEACHER', category: 'TEACHING' },
      roles: [{ role: { name: 'CLASS_TEACHER', rolePermissions: [{ permission: { key: 'teachers.view' } }] } }],
      classTeachers: [],
      teachingAssignments: [],
      _count: { sbaRecords: 0 },
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    prismaMock.sbaRecord.groupBy.mockResolvedValue([])

    const res = await request(app).get('/api/academic/teachers/user-2').set('Authorization', 'Bearer token')
    expect(res.status).toBe(200)
    expect(res.body.data.passwordHash).toBeUndefined()
    expect(res.body.data.fullName).toBe('Kofi Mensah')
    expect(JSON.stringify(res.body.data)).not.toContain('hashedcredentialmaterial')
  })

  // ----- Teaching assignments ------------------------------------------------

  it('rejects assigning a teacher without assignments.manage with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ASSISTANT_HEADTEACHER', ['teachers.view'])] }),
    )
    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', 'Bearer token')
      .send({ teacherId: 'user-2', subjectId: 'sub-1', classId: 'cls-1' })
    expect(res.status).toBe(403)
  })

  it('allows a HEADTEACHER to assign a teaching assignment (201)', async () => {
    prismaMock.schoolClass.findUnique.mockResolvedValue(klassRow())
    prismaMock.subject.findUnique.mockResolvedValue({ ...subjectRow(), _count: undefined })
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.id === 'user-1'
        ? baseUser({ roles: [roleEntry('HEADTEACHER', HEADTEACHER_ROLES)] })
        : staffUser(),
    )
    prismaMock.teachingAssignment.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValue(assignmentRow())
    prismaMock.teachingAssignment.upsert.mockResolvedValue({ id: 'ta-1', createdAt: new Date('2026-01-01T00:00:00.000Z') })
    prismaMock.teachingAssignment.findMany.mockResolvedValue([])
    prismaMock.teachingAssignment.findFirst.mockResolvedValue(null)
    prismaMock.sbaRecord.groupBy.mockResolvedValue([])

    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', 'Bearer token')
      .send({ teacherId: 'user-2', subjectId: 'sub-1', classId: 'cls-1' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(prismaMock.auditLog.create).toHaveBeenCalled()
  })

  it('rejects assigning an inactive staff member with 400', async () => {
    prismaMock.schoolClass.findUnique.mockResolvedValue(klassRow())
    prismaMock.subject.findUnique.mockResolvedValue({ ...subjectRow(), _count: undefined })
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.id === 'user-1'
        ? baseUser({ roles: [roleEntry('HEADTEACHER', HEADTEACHER_ROLES)] })
        : staffUser({ status: 'INACTIVE' }),
    )
    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', 'Bearer token')
      .send({ teacherId: 'user-2', subjectId: 'sub-1', classId: 'cls-1' })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('inactive')
  })

  it('rejects assigning a non-teaching staff member with 400', async () => {
    prismaMock.schoolClass.findUnique.mockResolvedValue(klassRow())
    prismaMock.subject.findUnique.mockResolvedValue({ ...subjectRow(), _count: undefined })
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.id === 'user-1'
        ? baseUser({ roles: [roleEntry('HEADTEACHER', HEADTEACHER_ROLES)] })
        : staffUser({ staffProfile: { staffId: 'STF-0003', position: 'CLEANER', category: 'NON_TEACHING' } }),
    )
    const res = await request(app)
      .post('/api/academic/assignments')
      .set('Authorization', 'Bearer token')
      .send({ teacherId: 'user-2', subjectId: 'sub-1', classId: 'cls-1' })
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('not an eligible')
  })

  // ----- Class teacher assignment ---------------------------------------------

  it('rejects assigning a class teacher without assignments.manage with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ASSISTANT_HEADTEACHER', ['teachers.view'])] }),
    )
    const res = await request(app)
      .put('/api/academic/classes/cls-1/class-teacher')
      .set('Authorization', 'Bearer token')
      .send({ teacherId: 'user-2' })
    expect(res.status).toBe(403)
  })

  it('allows a HEADTEACHER to assign a class teacher', async () => {
    prismaMock.schoolClass.findUnique.mockResolvedValue(klassRow())
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.id === 'user-1'
        ? baseUser({ roles: [roleEntry('HEADTEACHER', HEADTEACHER_ROLES)] })
        : staffUser(),
    )
    prismaMock.classTeacher.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.classId === 'cls-1'
        ? { id: 'ct-1', classId: 'cls-1', className: 'Class 1', class: { name: 'Class 1' }, teacherId: 'user-2', teacher: { fullName: 'Kofi Mensah' }, createdAt: new Date('2026-01-01T00:00:00.000Z') }
        : null,
    )
    prismaMock.classTeacher.upsert.mockResolvedValue({ id: 'ct-1', classId: 'cls-1', teacherId: 'user-2', assignedBy: 'user-1', createdAt: new Date('2026-01-01T00:00:00.000Z') })

    const res = await request(app)
      .put('/api/academic/classes/cls-1/class-teacher')
      .set('Authorization', 'Bearer token')
      .send({ teacherId: 'user-2' })
    expect(res.status).toBe(200)
    expect(res.body.data.className).toBe('Class 1')
    expect(prismaMock.auditLog.create).toHaveBeenCalled()
  })

  // ----- Academic stats --------------------------------------------------------

  it('allows a HEADTEACHER to read academic stats', async () => {
    prismaMock.academicTerm.findFirst.mockResolvedValue(null)
    prismaMock.user.findMany.mockResolvedValue([{ status: 'ACTIVE' }, { status: 'ACTIVE' }, { status: 'INACTIVE' }])
    prismaMock.schoolClass.count.mockResolvedValue(5)
    prismaMock.subject.groupBy.mockResolvedValue([
      { status: 'ACTIVE', _count: { _all: 3 } },
      { status: 'INACTIVE', _count: { _all: 1 } },
    ])
    prismaMock.teachingAssignment.groupBy.mockResolvedValue([{ status: 'ACTIVE', _count: { _all: 2 } }])
    prismaMock.classTeacher.count.mockResolvedValue(1)
    prismaMock.sbaRecord.count.mockResolvedValue(10)

    const res = await request(app).get('/api/academic/stats').set('Authorization', 'Bearer token')
    expect(res.status).toBe(200)
    expect(res.body.data.teachers).toMatchObject({ total: 3, active: 2 })
    expect(res.body.data.subjects).toMatchObject({ total: 4, active: 3 })
    expect(res.body.data.sba.total).toBe(10)
  })

  // ----- SBA -------------------------------------------------------------------

  it('rejects a user without sba.view from listing SBA with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser({ roles: [roleEntry('ACCOUNTANT', ['finance.view'])] }))
    const res = await request(app).get('/api/sba').set('Authorization', 'Bearer token')
    expect(res.status).toBe(403)
    expect(prismaMock.sbaRecord.findMany).not.toHaveBeenCalled()
  })

  it('rejects bulk SBA entry without sba.manage with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('CLASS_TEACHER', ['academic.view', 'sba.view'])] }),
    )
    const res = await request(app)
      .post('/api/sba/bulk')
      .set('Authorization', 'Bearer token')
      .send({ subjectId: 'sub-1', classId: 'cls-1', termId: 't-1', entries: [{ pupilId: 'p-1', score: 80, maxScore: 100 }] })
    expect(res.status).toBe(403)
  })

  it('returns 422 for SBA entries where score exceeds maxScore', async () => {
    const res = await request(app)
      .post('/api/sba/bulk')
      .set('Authorization', 'Bearer token')
      .send({ subjectId: 'sub-1', classId: 'cls-1', termId: 't-1', entries: [{ pupilId: 'p-1', score: 120, maxScore: 100 }] })
    expect(res.status).toBe(422)
    expect(res.body.errors.some((error: { field: string }) => error.field.startsWith('entries.'))).toBe(true)
  })

  it('allows a HEADTEACHER to bulk upsert SBA scores', async () => {
    prismaMock.schoolClass.findUnique.mockResolvedValue(klassRow())
    prismaMock.subject.findUnique.mockResolvedValue(subjectRow())
    prismaMock.academicTerm.findUnique.mockResolvedValue({ id: 't-1', name: 'First Term', status: 'ACTIVE' })
    prismaMock.pupil.findMany.mockResolvedValue([{ id: 'p-1', classId: 'cls-1' }])
    prismaMock.sbaRecord.upsert.mockResolvedValue({ id: 'rec-1' })
    prismaMock.sbaRecord.findMany.mockResolvedValue([sbaRecordRow()])

    const res = await request(app)
      .post('/api/sba/bulk')
      .set('Authorization', 'Bearer token')
      .send({
        subjectId: 'sub-1',
        classId: 'cls-1',
        termId: 't-1',
        entries: [{ pupilId: 'p-1', score: 85.5, maxScore: 100 }],
      })
    expect(res.status).toBe(200)
    expect(res.body.data.upserted).toBe(1)
    expect(res.body.data.records[0].score).toBe('85.50')
    expect(prismaMock.auditLog.create).toHaveBeenCalled()
  })
})