import { Prisma } from '@prisma/client'
import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'

const verifyTokenMock = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn(), findUnique: vi.fn() },
  academicSession: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  academicTerm: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
  financeFee: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  feeAssignment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
  },
  feeCharge: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    updateMany: vi.fn(),
    aggregate: vi.fn(),
  },
  payment: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    update: vi.fn(),
  },
  paymentAllocation: { deleteMany: vi.fn() },
  pupil: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  schoolClass: {
    findMany: vi.fn(),
  },
  attendance: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  dailyReconciliationClose: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
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

const FINANCE_ROLES: Record<string, string[]> = {
  accountant: ['finance.view', 'finance.manage', 'fees.manage', 'payments.record', 'academic.view'],
  headteacher: ['finance.view', 'academic.view', 'academic.manage'],
}

function financeSession() {
  return {
    id: 's-1',
    name: '2025/2026 Academic Year',
    startDate: new Date('2025-09-01T00:00:00.000Z'),
    endDate: new Date('2026-07-31T00:00:00.000Z'),
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    _count: { terms: 2, fees: 1 },
  }
}

function financeTerm() {
  return {
    id: 't-1',
    sessionId: 's-1',
    name: 'First Term',
    termNumber: 1,
    startDate: new Date('2025-09-01T00:00:00.000Z'),
    endDate: new Date('2025-12-19T00:00:00.000Z'),
    schoolDays: 80,
    status: 'ACTIVE',
  }
}

describe('finance routes (auth + RBAC enforcement)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyTokenMock.mockReturnValue({ sub: 'user-1', kind: 'staff' })
    prismaMock.user.findUnique.mockResolvedValue(baseUser())
    prismaMock.user.findMany.mockResolvedValue([])
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.payment.count.mockResolvedValue(0)
    prismaMock.academicSession.findUnique.mockResolvedValue(null)
    prismaMock.financeFee.findUnique.mockResolvedValue(null)
    prismaMock.$transaction.mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') return arg(prismaMock)
      return Promise.resolve(arg)
    })
  })

  it('rejects unauthenticated access to the finance summary with 401', async () => {
    const res = await request(app).get('/api/finance/summary')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('rejects a user without finance.view from reading the summary with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser({ roles: [roleEntry('SUPPORT_STAFF', [])] }))

    const res = await request(app).get('/api/finance/summary').set('Authorization', 'Bearer token')
    expect(res.status).toBe(403)
    expect(prismaMock.feeCharge.aggregate).not.toHaveBeenCalled()
  })

  it('allows a HEADTEACHER with finance.view to read the summary', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', FINANCE_ROLES.headteacher)] }),
    )
    prismaMock.academicSession.findFirst.mockResolvedValue(financeSession())
    prismaMock.academicTerm.findFirst.mockResolvedValue(financeTerm())
    prismaMock.feeCharge.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal('1000.00') } })
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountPaid: null }, _count: 0 })
    prismaMock.financeFee.findMany.mockResolvedValue([])
    prismaMock.feeCharge.findMany.mockResolvedValue([
      {
        amount: new Prisma.Decimal('600.00'),
        assignment: { pupilId: 'p-1' },
        allocations: [{ amount: new Prisma.Decimal('400.00') }],
      },
    ])
    prismaMock.payment.findMany.mockResolvedValue([])

    const res = await request(app).get('/api/finance/summary').set('Authorization', 'Bearer token')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data.session).toMatchObject({ name: '2025/2026 Academic Year' })
    expect(res.body.data.outstanding).toBe('600.00')
  })

  it('rejects creating a fee without fees.manage with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', FINANCE_ROLES.headteacher)] }),
    )

    const res = await request(app)
      .post('/api/fees')
      .set('Authorization', 'Bearer token')
      .send({ sessionId: 's-1', name: 'Tuition', feeType: 'TERMLY', amount: '120.50' })
    expect(res.status).toBe(403)
  })

  it('allows an ACCOUNTANT to create a fee and returns 201', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
    )
    prismaMock.academicSession.findUnique.mockResolvedValue(financeSession())
    prismaMock.academicTerm.findUnique.mockResolvedValue(financeTerm())
    prismaMock.financeFee.create.mockResolvedValue({
      id: 'f-1',
      sessionId: 's-1',
      termId: 't-1',
      name: 'Tuition',
      feeType: 'TERMLY',
      amount: new Prisma.Decimal('120.50'),
      description: null,
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      session: { name: '2025/2026 Academic Year' },
      term: { id: 't-1', name: 'First Term', schoolDays: 80 },
      assignments: [],
      _count: { assignments: 0 },
    })
    prismaMock.pupil.findMany.mockResolvedValue([{ id: 'p-1' }])
    prismaMock.feeAssignment.createMany.mockResolvedValue({ count: 1 })
    prismaMock.feeAssignment.findMany.mockResolvedValue([{ id: 'a-1' }])
    prismaMock.feeCharge.createMany.mockResolvedValue({ count: 1 })
    prismaMock.financeFee.findUnique.mockResolvedValue({
      id: 'f-1',
      sessionId: 's-1',
      termId: 't-1',
      name: 'Tuition',
      feeType: 'TERMLY',
      amount: new Prisma.Decimal('120.50'),
      description: null,
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      session: { name: '2025/2026 Academic Year' },
      term: { id: 't-1', name: 'First Term', schoolDays: 80 },
      assignments: [],
      _count: { assignments: 0, charges: 0 },
    })

    const res = await request(app)
      .post('/api/fees')
      .set('Authorization', 'Bearer token')
      .send({ sessionId: 's-1', termId: 't-1', name: 'Tuition', feeType: 'TERMLY', amount: '120.50' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.amount).toBe('120.50')
  })

  it('returns structured validation errors (422) for an invalid fee payload', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
    )

    const res = await request(app)
      .post('/api/fees')
      .set('Authorization', 'Bearer token')
      .send({ sessionId: 's-1', name: 'Tuition', feeType: 'WEEKLY', amount: '0' })
    expect(res.status).toBe(422)
    expect(res.body.success).toBe(false)
    expect(Array.isArray(res.body.errors)).toBe(true)
    expect(res.body.errors.some((error: { field: string }) => error.field === 'feeType')).toBe(true)
    expect(res.body.errors.some((error: { field: string }) => error.field === 'amount')).toBe(true)
  })

  it('rejects recording a payment without payments.record with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', FINANCE_ROLES.headteacher)] }),
    )

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', 'Bearer token')
      .send({ pupilId: 'p-1', amountPaid: '100.00', paymentMethod: 'CASH' })
    expect(res.status).toBe(403)
  })

  it('allows an ACCOUNTANT to record a payment and returns 201', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
    )
    prismaMock.pupil.findUnique.mockResolvedValue({ id: 'p-1', pupilId: 'PRPS-PUP-0001' })
    prismaMock.feeCharge.findMany.mockResolvedValue([
      {
        id: 'c-1',
        assignmentId: 'a-1',
        termId: 't-1',
        amount: new Prisma.Decimal('100.00'),
        status: 'ACTIVE',
        allocations: [],
      },
    ])
    prismaMock.payment.create.mockResolvedValue({
      id: 'pay-1',
      paymentReference: 'PRPS-PAY-000001',
      pupilId: 'p-1',
      amountPaid: new Prisma.Decimal('100.00'),
      paymentMethod: 'CASH',
      paymentDate: new Date('2026-01-10T00:00:00.000Z'),
      note: null,
      receivedById: 'user-1',
      status: 'ACTIVE',
      voidedAt: null,
      voidedById: null,
      voidReason: null,
      createdAt: new Date('2026-01-10T00:00:00.000Z'),
      pupil: { id: 'p-1', pupilId: 'PRPS-PUP-0001', firstName: 'Ama', lastName: 'Owusu' },
      allocations: [
        {
          id: 'al-1',
          chargeId: 'c-1',
          amount: new Prisma.Decimal('100.00'),
          charge: { assignment: { fee: { id: 'f-1', name: 'Tuition' } }, term: { id: 't-1', name: 'First Term' } },
        },
      ],
    })

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', 'Bearer token')
      .send({ pupilId: 'p-1', amountPaid: '100.00', paymentMethod: 'CASH' })
    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.paymentReference).toBe('PRPS-PAY-000001')
  })

  it('returns 422 for an invalid payment payload', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
    )

    const res = await request(app)
      .post('/api/payments')
      .set('Authorization', 'Bearer token')
      .send({ pupilId: 'p-1', amountPaid: '-5', paymentMethod: 'BITCOIN' })
    expect(res.status).toBe(422)
    expect(res.body.errors.some((error: { field: string }) => error.field === 'paymentMethod')).toBe(true)
  })

  it('requires academic.manage to create a session', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
    )

    const res = await request(app)
      .post('/api/finance/sessions')
      .set('Authorization', 'Bearer token')
      .send({ name: '2026/2027', startDate: '2026-09-01', endDate: '2027-07-31' })
    expect(res.status).toBe(403)
  })

  it('allows a HEADTEACHER with academic.manage to create a session', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', FINANCE_ROLES.headteacher)] }),
    )
    prismaMock.academicSession.findUnique.mockImplementation(
      async ({ where }: { where: Record<string, string> }) => (where.id === 's-1' ? financeSession() : null),
    )
    prismaMock.academicSession.create.mockResolvedValue(financeSession())

    const res = await request(app)
      .post('/api/finance/sessions')
      .set('Authorization', 'Bearer token')
      .send({ name: '2025/2026 Academic Year', startDate: '2025-09-01', endDate: '2026-07-31' })
    expect(res.status).toBe(201)
    expect(res.body.data.name).toBe('2025/2026 Academic Year')
  })

  it('rejects a user without finance.view from listing fees with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('CLASS_TEACHER', [])] }),
    )

    const res = await request(app).get('/api/fees').set('Authorization', 'Bearer token')
    expect(res.status).toBe(403)
    expect(prismaMock.financeFee.findMany).not.toHaveBeenCalled()
  })

  it('allows listing fees for a user with finance.view', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
    )
    prismaMock.financeFee.findMany.mockResolvedValue([])

    const res = await request(app).get('/api/fees').set('Authorization', 'Bearer token')
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
  })

  it('rejects a user without payments.record from voiding a payment with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', FINANCE_ROLES.headteacher)] }),
    )

    const res = await request(app)
      .post('/api/payments/pay-1/void')
      .set('Authorization', 'Bearer token')
      .send({ reason: 'Entered in error' })
    expect(res.status).toBe(403)
  })

  it('rejects assigning pupils to a fee without fees.manage with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', FINANCE_ROLES.headteacher)] }),
    )

    const res = await request(app)
      .post('/api/fees/f-1/assign')
      .set('Authorization', 'Bearer token')
      .send({ pupilIds: ['p-1'] })
    expect(res.status).toBe(403)
  })

  it('rejects unauthenticated access to reconciliation with 401', async () => {
    const res = await request(app).get('/api/finance/reconciliation?date=2026-01-05&feeType=DAILY')
    expect(res.status).toBe(401)
  })

  it('rejects a user without finance.view from reading reconciliation with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('SUPPORT_STAFF', [])] }),
    )

    const res = await request(app)
      .get('/api/finance/reconciliation?date=2026-01-05&feeType=DAILY')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(403)
  })

  it('returns 400 when date parameter is missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
    )

    const res = await request(app)
      .get('/api/finance/reconciliation?feeType=DAILY')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when feeType parameter is missing', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
    )

    const res = await request(app)
      .get('/api/finance/reconciliation?date=2026-01-05')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('returns 400 when feeType is invalid', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
    )

    const res = await request(app)
      .get('/api/finance/reconciliation?date=2026-01-05&feeType=WEEKLY')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
  })

  it('allows an ACCOUNTANT with finance.view to read reconciliation', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
    )
    prismaMock.academicSession.findFirst.mockResolvedValue(financeSession())
    prismaMock.academicTerm.findFirst.mockResolvedValue(financeTerm())
    prismaMock.schoolClass.findMany.mockResolvedValue([])
    prismaMock.financeFee.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/finance/reconciliation?date=2026-01-05&feeType=DAILY')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(400)
    expect(res.body.success).toBe(false)
    expect(res.body.message).toContain('Daily Fee')
  })

  it('allows a HEADTEACHER with finance.view to read reconciliation', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', FINANCE_ROLES.headteacher)] }),
    )
    prismaMock.academicSession.findFirst.mockResolvedValue(financeSession())
    prismaMock.academicTerm.findFirst.mockResolvedValue(financeTerm())
    prismaMock.schoolClass.findMany.mockResolvedValue([])
    prismaMock.financeFee.findFirst.mockResolvedValue(null)

    const res = await request(app)
      .get('/api/finance/reconciliation?date=2026-01-05&feeType=PA')
      .set('Authorization', 'Bearer token')
    expect(res.status).toBe(400)
    expect(res.body.message).toContain('PA Fee')
  })

  describe('GET /finance/pupils/daily', () => {
    it('rejects unauthenticated access with 401', async () => {
      const res = await request(app).get('/api/finance/pupils/daily?date=2026-01-05')
      expect(res.status).toBe(401)
    })

    it('rejects a user without finance.view with 403', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        baseUser({ roles: [roleEntry('SUPPORT_STAFF', [])] }),
      )

      const res = await request(app)
        .get('/api/finance/pupils/daily?date=2026-01-05')
        .set('Authorization', 'Bearer token')
      expect(res.status).toBe(403)
    })

    it('returns 400 when date parameter is missing', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
      )

      const res = await request(app)
        .get('/api/finance/pupils/daily')
        .set('Authorization', 'Bearer token')
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('returns 400 when date is a weekend', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
      )

      const res = await request(app)
        .get('/api/finance/pupils/daily?date=2026-01-03')
        .set('Authorization', 'Bearer token')
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
    })

    it('allows an ACCOUNTANT with finance.view to read daily pupil finance', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
      )
      prismaMock.academicSession.findFirst.mockResolvedValue(financeSession())
      prismaMock.academicTerm.findFirst.mockResolvedValue(financeTerm())
      prismaMock.schoolClass.findMany.mockResolvedValue([])
      prismaMock.financeFee.findFirst.mockResolvedValue(null)

      const res = await request(app)
        .get('/api/finance/pupils/daily?date=2026-01-05')
        .set('Authorization', 'Bearer token')
      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain('Daily Fee')
    })

    it('allows a HEADTEACHER with finance.view to read daily pupil finance', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        baseUser({ roles: [roleEntry('HEADTEACHER', FINANCE_ROLES.headteacher)] }),
      )
      prismaMock.academicSession.findFirst.mockResolvedValue(financeSession())
      prismaMock.academicTerm.findFirst.mockResolvedValue(financeTerm())
      prismaMock.schoolClass.findMany.mockResolvedValue([])
      prismaMock.financeFee.findFirst.mockResolvedValue(null)

      const res = await request(app).get('/api/finance/pupils/daily?date=2026-01-05').set('Authorization', 'Bearer token')
      expect(res.status).toBe(400)
      expect(res.body.message).toContain('Daily Fee')
    })
  })

  describe('PATCH /finance/reconciliation/attendance', () => {
    const attendancePayload = { pupilId: 'p-1', date: '2026-01-05', status: 'PRESENT' }
    const selectedDate = new Date('2026-01-05T00:00:00.000Z')

    function bareAttendanceRecord(overrides: Record<string, unknown> = {}) {
      return {
        id: 'att-1',
        pupilId: 'p-1',
        staffId: 'user-1',
        date: selectedDate,
        status: 'ABSENT',
        sessionId: 's-1',
        classId: 'c-1',
        notes: null,
        latitude: null,
        longitude: null,
        accuracy: null,
        capturedAt: null,
        createdAt: new Date('2026-01-05T08:00:00.000Z'),
        updatedAt: new Date('2026-01-05T08:00:00.000Z'),
        ...overrides,
      }
    }

    function attendanceViewRecord(overrides: Record<string, unknown> = {}) {
      return {
        ...bareAttendanceRecord(),
        pupil: { firstName: 'Ama', lastName: 'Mensah', pupilId: 'PRPS-P-001' },
        staff: { fullName: 'Ama Mensah' },
        ...overrides,
      }
    }

    function mockAuthorizedActor() {
      prismaMock.user.findUnique.mockResolvedValue(
        baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
      )
      prismaMock.pupil.findUnique.mockResolvedValue({ id: 'p-1', pupilId: 'PRPS-P-001', status: 'ACTIVE', classId: 'c-1' })
      prismaMock.academicSession.findFirst.mockResolvedValue(financeSession())
      prismaMock.dailyReconciliationClose.findUnique.mockResolvedValue(null)
    }

    beforeEach(() => {
      prismaMock.attendance.findFirst.mockResolvedValue(null)
      prismaMock.attendance.findUnique.mockResolvedValue(null)
      prismaMock.attendance.create.mockResolvedValue(attendanceViewRecord({ status: 'PRESENT' }))
      prismaMock.attendance.update.mockResolvedValue(attendanceViewRecord({ status: 'PRESENT' }))
      prismaMock.dailyReconciliationClose.findUnique.mockResolvedValue(null)
    })

    it('rejects unauthenticated access with 401', async () => {
      const res = await request(app).patch('/api/finance/reconciliation/attendance').send(attendancePayload)
      expect(res.status).toBe(401)
    })

    it('rejects a user without payments.record with 403 and never touches attendance', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        baseUser({ roles: [roleEntry('SUPPORT_STAFF', [])] }),
      )

      const res = await request(app)
        .patch('/api/finance/reconciliation/attendance')
        .set('Authorization', 'Bearer token')
        .send(attendancePayload)
      expect(res.status).toBe(403)
      expect(prismaMock.attendance.findFirst).not.toHaveBeenCalled()
      expect(prismaMock.attendance.update).not.toHaveBeenCalled()
      expect(prismaMock.attendance.create).not.toHaveBeenCalled()
    })

    it('keeps OWNER read-only: rejects with 403 even though OWNER has finance.view', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        baseUser({
          roles: [
            roleEntry('OWNER', ['owner.manage', 'finance.view', 'attendance.view', 'reports.view']),
          ],
        }),
      )

      const res = await request(app)
        .patch('/api/finance/reconciliation/attendance')
        .set('Authorization', 'Bearer token')
        .send(attendancePayload)
      expect(res.status).toBe(403)
      expect(prismaMock.attendance.findFirst).not.toHaveBeenCalled()
      expect(prismaMock.attendance.update).not.toHaveBeenCalled()
      expect(prismaMock.attendance.create).not.toHaveBeenCalled()
    })

    it('allows an ACCOUNTANT with payments.record to toggle attendance', async () => {
      mockAuthorizedActor()
      prismaMock.attendance.findFirst.mockResolvedValue(bareAttendanceRecord({ status: 'ABSENT' }))
      prismaMock.attendance.findUnique.mockResolvedValue(bareAttendanceRecord({ status: 'ABSENT' }))
      prismaMock.attendance.update.mockResolvedValue(attendanceViewRecord({ status: 'PRESENT' }))

      const res = await request(app)
        .patch('/api/finance/reconciliation/attendance')
        .set('Authorization', 'Bearer token')
        .send(attendancePayload)
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.status).toBe('PRESENT')
    })

    it('allows a HEADTEACHER with payments.record to toggle attendance', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        baseUser({ roles: [roleEntry('HEADTEACHER', ['finance.view', 'payments.record', 'attendance.view'])] }),
      )
      prismaMock.pupil.findUnique.mockResolvedValue({ id: 'p-1', pupilId: 'PRPS-P-001', status: 'ACTIVE', classId: 'c-1' })
      prismaMock.academicSession.findFirst.mockResolvedValue(financeSession())
      prismaMock.attendance.findFirst.mockResolvedValue(bareAttendanceRecord({ status: 'PRESENT' }))
      prismaMock.attendance.findUnique.mockResolvedValue(bareAttendanceRecord({ status: 'PRESENT' }))
      prismaMock.attendance.update.mockResolvedValue(attendanceViewRecord({ status: 'ABSENT' }))

      const res = await request(app)
        .patch('/api/finance/reconciliation/attendance')
        .set('Authorization', 'Bearer token')
        .send({ ...attendancePayload, status: 'ABSENT' })
      expect(res.status).toBe(200)
      expect(res.body.data.status).toBe('ABSENT')
    })

    it('persists ABSENT → PRESENT by updating the existing record (no duplicate created)', async () => {
      mockAuthorizedActor()
      prismaMock.attendance.findFirst.mockResolvedValue(bareAttendanceRecord({ status: 'ABSENT' }))
      prismaMock.attendance.findUnique.mockResolvedValue(bareAttendanceRecord({ status: 'ABSENT' }))
      prismaMock.attendance.update.mockResolvedValue(attendanceViewRecord({ status: 'PRESENT' }))

      const res = await request(app)
        .patch('/api/finance/reconciliation/attendance')
        .set('Authorization', 'Bearer token')
        .send(attendancePayload)
      expect(res.status).toBe(200)
      expect(prismaMock.attendance.create).not.toHaveBeenCalled()
      expect(prismaMock.attendance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-1' },
          data: { status: 'PRESENT' },
        }),
      )
    })

    it('persists PRESENT → ABSENT by updating the existing record (no duplicate created)', async () => {
      mockAuthorizedActor()
      prismaMock.attendance.findFirst.mockResolvedValue(bareAttendanceRecord({ status: 'PRESENT' }))
      prismaMock.attendance.findUnique.mockResolvedValue(bareAttendanceRecord({ status: 'PRESENT' }))
      prismaMock.attendance.update.mockResolvedValue(attendanceViewRecord({ status: 'ABSENT' }))

      const res = await request(app)
        .patch('/api/finance/reconciliation/attendance')
        .set('Authorization', 'Bearer token')
        .send({ ...attendancePayload, status: 'ABSENT' })
      expect(res.status).toBe(200)
      expect(prismaMock.attendance.create).not.toHaveBeenCalled()
      expect(prismaMock.attendance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'att-1' },
          data: { status: 'ABSENT' },
        }),
      )
    })

    it('updates the correct pupil on the selected date (not today)', async () => {
      mockAuthorizedActor()
      prismaMock.attendance.findFirst.mockResolvedValue(bareAttendanceRecord())
      prismaMock.attendance.findUnique.mockResolvedValue(bareAttendanceRecord())

      await request(app)
        .patch('/api/finance/reconciliation/attendance')
        .set('Authorization', 'Bearer token')
        .send(attendancePayload)

      expect(prismaMock.attendance.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pupilId: 'p-1', date: selectedDate },
        }),
      )
      expect(prismaMock.attendance.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'att-1' } }),
      )
    })

    it('creates a record for the selected date when none exists, linked to the active session', async () => {
      mockAuthorizedActor()
      prismaMock.attendance.findFirst.mockResolvedValue(null)

      const res = await request(app)
        .patch('/api/finance/reconciliation/attendance')
        .set('Authorization', 'Bearer token')
        .send(attendancePayload)
      expect(res.status).toBe(200)
      expect(prismaMock.attendance.update).not.toHaveBeenCalled()
      expect(prismaMock.attendance.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            pupilId: 'p-1',
            staffId: 'user-1',
            status: 'PRESENT',
            date: selectedDate,
            sessionId: 's-1',
            classId: 'c-1',
          }),
        }),
      )
    })

    it('returns 409 when the day\'s reconciliation is closed', async () => {
      mockAuthorizedActor()
      prismaMock.attendance.findFirst.mockResolvedValue(bareAttendanceRecord())
      prismaMock.attendance.findUnique.mockResolvedValue(bareAttendanceRecord())
      prismaMock.dailyReconciliationClose.findUnique.mockResolvedValue({
        id: 'close-1',
        date: selectedDate,
        sessionId: 's-1',
        termId: 't-1',
        closedById: 'user-1',
        closedAt: new Date('2026-01-05T18:00:00.000Z'),
        metadata: {},
      })

      const res = await request(app)
        .patch('/api/finance/reconciliation/attendance')
        .set('Authorization', 'Bearer token')
        .send(attendancePayload)
      expect(res.status).toBe(409)
      expect(res.body.message).toContain('closed and signed')
      expect(prismaMock.attendance.update).not.toHaveBeenCalled()
      expect(prismaMock.attendance.create).not.toHaveBeenCalled()
    })

    it('returns 404 for an unknown pupil', async () => {
      mockAuthorizedActor()
      prismaMock.pupil.findUnique.mockResolvedValue(null)

      const res = await request(app)
        .patch('/api/finance/reconciliation/attendance')
        .set('Authorization', 'Bearer token')
        .send(attendancePayload)
      expect(res.status).toBe(404)
    })

    it('returns 422 for an invalid attendance status', async () => {
      prismaMock.user.findUnique.mockResolvedValue(
        baseUser({ roles: [roleEntry('ACCOUNTANT', FINANCE_ROLES.accountant)] }),
      )

      const res = await request(app)
        .patch('/api/finance/reconciliation/attendance')
        .set('Authorization', 'Bearer token')
        .send({ ...attendancePayload, status: 'LATE' })
      expect(res.status).toBe(422)
      expect(res.body.errors.some((error: { field: string }) => error.field === 'status')).toBe(true)
    })
  })
})