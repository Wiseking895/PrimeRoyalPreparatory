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
    verifyTokenMock.mockReturnValue('user-1')
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
    prismaMock.payment.aggregate.mockResolvedValue({ _sum: { amountPaid: new Prisma.Decimal('400.00') } })
    prismaMock.financeFee.findMany.mockResolvedValue([])
    prismaMock.feeCharge.findMany.mockResolvedValue([])
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
    prismaMock.financeFee.create.mockResolvedValue({
      id: 'f-1',
      sessionId: 's-1',
      name: 'Tuition',
      feeType: 'TERMLY',
      amount: new Prisma.Decimal('120.50'),
      description: null,
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      session: { name: '2025/2026 Academic Year' },
      assignments: [],
      _count: { assignments: 0, charges: 0 },
    })
    prismaMock.financeFee.findUnique.mockResolvedValue({
      id: 'f-1',
      sessionId: 's-1',
      name: 'Tuition',
      feeType: 'TERMLY',
      amount: new Prisma.Decimal('120.50'),
      description: null,
      status: 'ACTIVE',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      session: { name: '2025/2026 Academic Year' },
      assignments: [],
      _count: { assignments: 0, charges: 0 },
    })

    const res = await request(app)
      .post('/api/fees')
      .set('Authorization', 'Bearer token')
      .send({ sessionId: 's-1', name: 'Tuition', feeType: 'TERMLY', amount: '120.50' })
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
})