import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'

const verifyTokenMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  pupil: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  schoolClass: { findUnique: vi.fn(), findMany: vi.fn() },
  guardian: { findFirst: vi.fn(), create: vi.fn() },
  pupilGuardian: { create: vi.fn(), deleteMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../lib/jwt', () => ({ verifyToken: verifyTokenMock }))
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

const app = createApp()

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    fullName: 'Grace Hopper',
    email: 'grace@school.edu',
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

function pupilRecord() {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id: 'p-1',
    pupilId: 'PRPS-PUP-0001',
    admissionNumber: null,
    firstName: 'Ama',
    middleName: null,
    lastName: 'Owusu',
    dateOfBirth: new Date('2019-05-12T00:00:00.000Z'),
    gender: 'FEMALE',
    profilePictureUrl: null,
    classId: 'class-1',
    dateAdmitted: now,
    status: 'ACTIVE',
    address: null,
    createdAt: now,
    updatedAt: now,
    class: { id: 'class-1', name: 'Primary 1' },
    guardians: [],
  }
}

const validCreate = {
  firstName: 'Ama',
  lastName: 'Owusu',
  dateOfBirth: '2019-05-12',
  gender: 'FEMALE',
  classId: 'class-1',
}

describe('pupil routes (auth + RBAC enforcement)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockReturnValue('user-1')
    prismaMock.user.findUnique.mockResolvedValue(baseUser())
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.$transaction.mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') return arg(prismaMock)
      return Promise.resolve(arg)
    })
  })

  it('rejects unauthenticated access to the pupil list with 401', async () => {
    const res = await request(app).get('/api/pupils')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('rejects a user without pupils.view with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('SUPPORT_STAFF', [])] }),
    )

    const res = await request(app).get('/api/pupils').set('Authorization', 'Bearer token')
    expect(res.status).toBe(403)
    expect(prismaMock.pupil.findMany).not.toHaveBeenCalled()
  })

  it('rejects creating a pupil without pupils.create with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('CLASS_TEACHER', ['pupils.view'])] }),
    )

    const res = await request(app)
      .post('/api/pupils')
      .set('Authorization', 'Bearer token')
      .send(validCreate)
    expect(res.status).toBe(403)
  })

  it('allows listing pupils for a user with pupils.view', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['pupils.view'])] }),
    )
    prismaMock.pupil.findMany.mockResolvedValue([pupilRecord()])
    prismaMock.pupil.count.mockResolvedValue(1)

    const res = await request(app).get('/api/pupils').set('Authorization', 'Bearer token')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.items).toHaveLength(1)
    expect(res.body.data.items[0].pupilId).toBe('PRPS-PUP-0001')
  })

  it('returns structured validation errors (422) for an invalid create payload', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['pupils.create'])] }),
    )

    const res = await request(app)
      .post('/api/pupils')
      .set('Authorization', 'Bearer token')
      .send({ firstName: '', dateOfBirth: 'not-a-date' })
    expect(res.status).toBe(422)
    expect(res.body.success).toBe(false)
    expect(Array.isArray(res.body.errors)).toBe(true)
    expect(res.body.errors.some((error: { field: string }) => error.field === 'firstName')).toBe(true)
  })

  it('creates a pupil with the right permissions and returns 201', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({
        roles: [roleEntry('HEADTEACHER', ['pupils.view', 'pupils.create', 'pupils.update'])],
      }),
    )
    prismaMock.schoolClass.findUnique.mockResolvedValue({ id: 'class-1', name: 'Primary 1' })
    prismaMock.pupil.create.mockResolvedValue({ id: 'p-1' })
    prismaMock.pupil.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.id === 'p-1' ? pupilRecord() : null,
    )
    prismaMock.guardian.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .post('/api/pupils')
      .set('Authorization', 'Bearer token')
      .send(validCreate)
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.pupilId).toBe('PRPS-PUP-0001')
  })

  it('rejects a user without pupils.update from deactivating a pupil with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('CLASS_TEACHER', ['pupils.view'])] }),
    )

    const res = await request(app)
      .post('/api/pupils/p-1/deactivate')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(403)
  })

  it('rejects unauthenticated access to the class list with 401', async () => {
    const res = await request(app).get('/api/classes')
    expect(res.status).toBe(401)
  })

  it('rejects a user without classes.manage from creating a class with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['classes.view'])] }),
    )

    const res = await request(app)
      .post('/api/classes')
      .set('Authorization', 'Bearer token')
      .send({ key: 'NEW', name: 'New Class' })
    expect(res.status).toBe(403)
  })

  it('allows listing classes for a user with classes.view', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['classes.view'])] }),
    )
    prismaMock.schoolClass.findMany.mockResolvedValue([])

    const res = await request(app).get('/api/classes').set('Authorization', 'Bearer token')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })
})