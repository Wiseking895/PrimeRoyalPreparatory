import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'

const verifyTokenMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  pupil: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  schoolClass: { findUnique: vi.fn(), findMany: vi.fn() },
  guardian: { findFirst: vi.fn(), create: vi.fn() },
  academicSession: { findFirst: vi.fn() },
  financeFee: { findMany: vi.fn() },
  feeAssignment: { createMany: vi.fn() },
  pupilGuardian: { create: vi.fn(), deleteMany: vi.fn() },
  pupilUniform: { createMany: vi.fn(), deleteMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../lib/jwt', () => ({ verifyToken: verifyTokenMock, verifyTokenPayload: verifyTokenMock }))
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
    nationality: null,
    religion: null,
    admissionReason: null,
    declarationAcknowledged: false,
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
    verifyTokenMock.mockReturnValue({ sub: 'user-1', kind: 'staff' })
    prismaMock.user.findUnique.mockResolvedValue(baseUser())
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.pupilUniform.createMany.mockResolvedValue({ count: 5 })
    prismaMock.pupilUniform.deleteMany.mockResolvedValue({ count: 0 })
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
    prismaMock.academicSession.findFirst.mockResolvedValue(null)
    prismaMock.financeFee.findMany.mockResolvedValue([])
    prismaMock.feeAssignment.createMany.mockResolvedValue({ count: 0 })

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

  // -------------------------------------------------------------------------
  // Word admission import
  // -------------------------------------------------------------------------

  it('rejects unauthenticated access to the import preview with 401', async () => {
    const res = await request(app).post('/api/pupils/import/preview')
    expect(res.status).toBe(401)
    expect(prismaMock.pupil.create).not.toHaveBeenCalled()
  })

  it('rejects a user without pupils.create from the import preview with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', ['finance.view'])] }),
    )

    const res = await request(app)
      .post('/api/pupils/import/preview')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(403)
    expect(prismaMock.pupil.create).not.toHaveBeenCalled()
  })

  it('rejects a user without pupils.create from confirming an import with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('CLASS_TEACHER', ['pupils.view'])] }),
    )

    const res = await request(app)
      .post('/api/pupils/import/confirm')
      .set('Authorization', 'Bearer token')
      .send({ pupils: [] })
    expect(res.status).toBe(403)
    expect(prismaMock.pupil.create).not.toHaveBeenCalled()
  })

  it('returns 400 when the preview has no uploaded file', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['pupils.create'])] }),
    )

    const res = await request(app)
      .post('/api/pupils/import/preview')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(400)
    expect(prismaMock.pupil.create).not.toHaveBeenCalled()
  })

  it('returns 422 for an empty confirm payload', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['pupils.create'])] }),
    )

    const res = await request(app)
      .post('/api/pupils/import/confirm')
      .set('Authorization', 'Bearer token')
      .send({ pupils: [] })
    expect(res.status).toBe(422)
    expect(prismaMock.pupil.create).not.toHaveBeenCalled()
  })

  it('confirms an import with pupils.create and creates the pupils', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['pupils.view', 'pupils.create'])] }),
    )
    prismaMock.schoolClass.findUnique.mockResolvedValue({ id: 'class-1', name: 'Basic 3' })
    prismaMock.pupil.findFirst.mockResolvedValue(null)
    prismaMock.pupil.create.mockResolvedValue({ id: 'p-1' })
    prismaMock.pupil.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.id === 'p-1' ? pupilRecord() : null,
    )
    prismaMock.guardian.findFirst.mockResolvedValue(null)
    prismaMock.academicSession.findFirst.mockResolvedValue(null)
    prismaMock.financeFee.findMany.mockResolvedValue([])
    prismaMock.feeAssignment.createMany.mockResolvedValue({ count: 0 })

    const res = await request(app)
      .post('/api/pupils/import/confirm')
      .set('Authorization', 'Bearer token')
      .send({
        pupils: [
          {
            rowNumber: 1,
            firstName: 'Ama',
            lastName: 'Owusu',
            dateOfBirth: '2019-05-12',
            gender: 'FEMALE',
            classId: 'class-1',
            guardians: [],
          },
        ],
      })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.created).toBe(1)
    expect(prismaMock.pupil.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'pupil.import_word' }),
      }),
    )
  })

  it('serves the import template to a user with pupils.create', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['pupils.create'])] }),
    )

    const res = await request(app)
      .get('/api/pupils/import/template')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('wordprocessingml')
    expect(res.headers['content-disposition']).toContain('PRPS-Pupil-Import-Template.docx')
  })

  it('rejects a user without pupils.create from downloading the template with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', ['finance.view'])] }),
    )

    const res = await request(app)
      .get('/api/pupils/import/template')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(403)
  })

  it('rejects unauthenticated access to the admission form with 401', async () => {
    const res = await request(app).get('/api/pupils/p-1/admission-form')
    expect(res.status).toBe(401)
    expect(prismaMock.pupil.findUnique).not.toHaveBeenCalled()
  })

  it('rejects a user without pupils.view from downloading the admission form with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', ['finance.view'])] }),
    )

    const res = await request(app)
      .get('/api/pupils/p-1/admission-form')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(403)
    expect(prismaMock.pupil.findUnique).not.toHaveBeenCalled()
  })

  it('serves the admission form PDF to a user with pupils.view', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['pupils.view'])] }),
    )
    prismaMock.pupil.findUnique.mockResolvedValue({
      ...pupilRecord(),
      admissionNumber: 'ADM-2026-001',
      sheetNumber: '28',
      admissionFee: '700.00',
      previousSchool: 'Sunrise International School',
      stayWithChild: 'Father',
      guardians: [
        {
          relationship: 'Father',
          isPrimary: true,
          isEmergency: false,
          guardian: {
            id: 'g-1',
            fullName: 'Kwabena Mensah',
            phone: '0244111222',
            email: null,
            address: 'Atimatim',
            occupation: 'Engineer',
          },
        },
        {
          relationship: 'Mother',
          isPrimary: false,
          isEmergency: false,
          guardian: {
            id: 'g-2',
            fullName: 'Ama Mensah',
            phone: null,
            email: null,
            address: 'Atimatim',
            occupation: 'Trader',
          },
        },
      ],
      uniforms: [
        { slot: 1, label: 'Main Uniform', status: 'COLLECTED' },
        { slot: 2, label: 'Outing', status: 'NOT_COLLECTED' },
        { slot: 3, label: 'Friday Wear', status: 'NOT_COLLECTED' },
        { slot: 4, label: 'Thursday Wear', status: 'NOT_COLLECTED' },
        { slot: 5, label: 'Cream Uniform', status: 'NOT_COLLECTED' },
      ],
    })
    prismaMock.academicSession.findFirst.mockResolvedValue({ name: '2026/2027' })

    const res = await request(app)
      .get('/api/pupils/p-1/admission-form')
      .set('Authorization', 'Bearer token')
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = []
        response.on('data', (chunk: Buffer) => chunks.push(chunk))
        response.on('end', () => callback(null, Buffer.concat(chunks)))
      })
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('application/pdf')
    expect(res.headers['content-disposition']).toContain(
      'attachment; filename="PRPS-Admission-Form-ADM-2026-001.pdf"',
    )
    expect(Buffer.isBuffer(res.body)).toBe(true)
    expect(res.body.subarray(0, 5).toString('latin1')).toBe('%PDF-')
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