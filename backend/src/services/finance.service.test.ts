import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'
import type { AuthenticatedUser } from '../types/auth'
import {
  assignPupilsToFee,
  createFee,
  createPayment,
  createSession,
  createTerm,
  deactivateAssignment,
  generateChargesForFee,
  generateChargesForSession,
  getFinanceSummary,
  getPupilFinance,
  getSession,
  getTerm,
  listFees,
  listPayments,
  listSessions,
  listTerms,
  setFeeStatus,
  setSessionStatus,
  setTermStatus,
  updateFee,
  updateSession,
  updateTerm,
  voidPayment,
} from './finance.service'

const prismaMock = vi.hoisted(() => ({
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
    create: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
  },
  feeCharge: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
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
  paymentAllocation: {
    deleteMany: vi.fn(),
  },
  pupil: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
  },
  user: {
    findMany: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

const accountant: AuthenticatedUser = {
  id: 'acc-1',
  fullName: 'Ama Mensah',
  email: 'ama@school.edu',
  phone: null,
  status: 'ACTIVE',
  staffId: 'PRPS-ACC-001',
  roleNames: ['ACCOUNTANT'],
  permissionKeys: ['finance.view', 'finance.manage', 'fees.manage', 'payments.record', 'academic.view'],
}

const now = new Date('2026-01-01T00:00:00.000Z')

function sessionRecord(id = 's-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    name: '2025/2026 Academic Year',
    startDate: new Date('2025-09-01T00:00:00.000Z'),
    endDate: new Date('2026-07-31T00:00:00.000Z'),
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    _count: { terms: 2, fees: 1 },
    ...overrides,
  }
}

function termRecord(id = 't-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    sessionId: 's-1',
    name: 'First Term',
    termNumber: 1,
    startDate: new Date('2025-09-01T00:00:00.000Z'),
    endDate: new Date('2025-12-19T00:00:00.000Z'),
    schoolDays: 80,
    status: 'ACTIVE',
    ...overrides,
  }
}

function feeRecord(id = 'f-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    sessionId: 's-1',
    name: 'Tuition',
    feeType: 'TERMLY',
    amount: new Prisma.Decimal('120.50'),
    description: null,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    session: { name: '2025/2026 Academic Year' },
    assignments: [{ id: 'a-1' }],
    _count: { assignments: 2, charges: 3 },
    ...overrides,
  }
}

function assignmentRecord(id = 'a-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    pupilId: 'p-1',
    feeId: 'f-1',
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    pupil: {
      id: 'p-1',
      pupilId: 'PRPS-PUP-0001',
      firstName: 'Ama',
      lastName: 'Owusu',
      class: { name: 'Primary 1' },
    },
    fee: { name: 'Tuition' },
    _count: { charges: 1 },
    ...overrides,
  }
}

function chargeRecord(id = 'c-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    assignmentId: 'a-1',
    termId: 't-1',
    amount: new Prisma.Decimal('120.50'),
    status: 'ACTIVE',
    cancelledAt: null,
    cancelledById: null,
    cancelReason: null,
    createdAt: now,
    assignment: { id: 'a-1', pupilId: 'p-1', fee: { id: 'f-1', name: 'Tuition' } },
    term: { id: 't-1', name: 'First Term' },
    allocations: [],
    ...overrides,
  }
}

function paymentRecord(id = 'pay-1', overrides: Record<string, unknown> = {}) {
  return {
    id,
    paymentReference: 'PRPS-PAY-000001',
    pupilId: 'p-1',
    amountPaid: new Prisma.Decimal('120.50'),
    paymentMethod: 'CASH',
    paymentDate: new Date('2026-01-10T00:00:00.000Z'),
    note: null,
    receivedById: 'acc-1',
    status: 'ACTIVE',
    voidedAt: null,
    voidedById: null,
    voidReason: null,
    createdAt: now,
    pupil: { id: 'p-1', pupilId: 'PRPS-PUP-0001', firstName: 'Ama', lastName: 'Owusu' },
    allocations: [
      {
        id: 'al-1',
        chargeId: 'c-1',
        amount: new Prisma.Decimal('120.50'),
        charge: {
          assignment: { fee: { id: 'f-1', name: 'Tuition' } },
          term: { id: 't-1', name: 'First Term' },
        },
      },
    ],
    ...overrides,
  }
}

function setupFeeLookup() {
  prismaMock.financeFee.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
    where.id === 'f-1' ? feeRecord() : null,
  )
}

describe('finance.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.user.findMany.mockResolvedValue([])
    prismaMock.academicSession.findUnique.mockResolvedValue(null)
    prismaMock.academicTerm.findUnique.mockResolvedValue(null)
    prismaMock.financeFee.findUnique.mockResolvedValue(null)
    prismaMock.feeAssignment.findUnique.mockResolvedValue(null)
    prismaMock.payment.findUnique.mockResolvedValue(null)
    prismaMock.$transaction.mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') return arg(prismaMock)
      return Promise.resolve(arg)
    })
  })

  describe('sessions', () => {
    it('creates an ACTIVE session and demotes other ACTIVE sessions', async () => {
      prismaMock.academicSession.findUnique.mockResolvedValue(null)
      prismaMock.academicSession.create.mockResolvedValue(sessionRecord())
      prismaMock.academicSession.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === 's-1' ? sessionRecord() : null,
      )

      const result = await createSession(accountant, {
        name: '2025/2026 Academic Year',
        startDate: '2025-09-01',
        endDate: '2026-07-31',
      })

      expect(prismaMock.academicSession.updateMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        data: { status: 'INACTIVE' },
      })
      expect(prismaMock.academicSession.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: '2025/2026 Academic Year', status: 'ACTIVE' }),
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'finance.session.create' }) }),
      )
      expect(result.name).toBe('2025/2026 Academic Year')
    })

    it('rejects a duplicate session name', async () => {
      prismaMock.academicSession.findUnique.mockResolvedValue(sessionRecord())

      await expect(
        createSession(accountant, {
          name: '2025/2026 Academic Year',
          startDate: '2025-09-01',
          endDate: '2026-07-31',
        }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.Conflict })
    })

    it('rejects an end date that is not after the start date', async () => {
      await expect(
        createSession(accountant, {
          name: 'Bad Session',
          startDate: '2025-09-01',
          endDate: '2025-08-01',
        }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.BadRequest })
    })

    it('activates a session and demotes the current ACTIVE session', async () => {
      prismaMock.academicSession.findUnique
        .mockReturnValueOnce(sessionRecord('s-2', { name: '2026/2027 Academic Year', status: 'INACTIVE' }))
        .mockResolvedValue(sessionRecord('s-2', { status: 'ACTIVE' }))

      const result = await setSessionStatus(accountant, 's-2', 'ACTIVE')

      expect(prismaMock.academicSession.updateMany).toHaveBeenCalledWith({
        where: { id: { not: 's-2' }, status: 'ACTIVE' },
        data: { status: 'INACTIVE' },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'finance.session.activate' }) }),
      )
      expect(result.status).toBe('ACTIVE')
    })

    it('is a no-op when the session status does not change', async () => {
      prismaMock.academicSession.findUnique.mockResolvedValue(sessionRecord())

      await setSessionStatus(accountant, 's-1', 'ACTIVE')

      expect(prismaMock.academicSession.update).not.toHaveBeenCalled()
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
    })

    it('throws a 404 for a missing session', async () => {
      await expect(getSession('missing')).rejects.toMatchObject({ statusCode: HttpStatus.NotFound })
    })

    it('lists sessions in start date order', async () => {
      prismaMock.academicSession.findMany.mockResolvedValue([sessionRecord()])
      const result = await listSessions()
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ name: '2025/2026 Academic Year', termCount: 2, feeCount: 1 })
    })

    it('updates session fields and audits the change', async () => {
      prismaMock.academicSession.findUnique.mockResolvedValue(sessionRecord())
      prismaMock.academicSession.update.mockResolvedValue(sessionRecord())

      await updateSession(accountant, 's-1', { name: '2025/2026 Session', status: 'INACTIVE' })

      expect(prismaMock.academicSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 's-1' },
          data: expect.objectContaining({ name: '2025/2026 Session', status: 'INACTIVE' }),
        }),
      )
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'finance.session.update',
            metadata: expect.objectContaining({ changed: expect.arrayContaining(['name', 'status']) }),
          }),
        }),
      )
    })
  })

  describe('terms', () => {
    it('creates a term and keeps one ACTIVE term per session', async () => {
      prismaMock.academicSession.findUnique.mockResolvedValue(sessionRecord())
      prismaMock.academicTerm.create.mockResolvedValue(termRecord())
      prismaMock.academicTerm.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === 't-1' ? termRecord() : null,
      )

      const result = await createTerm(accountant, {
        sessionId: 's-1',
        name: 'First Term',
        termNumber: 1,
        startDate: '2025-09-01',
        endDate: '2025-12-19',
        schoolDays: 80,
      })

      expect(prismaMock.academicTerm.updateMany).toHaveBeenCalledWith({
        where: { sessionId: 's-1', status: 'ACTIVE' },
        data: { status: 'INACTIVE' },
      })
      expect(prismaMock.academicTerm.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ sessionId: 's-1', name: 'First Term', termNumber: 1, schoolDays: 80 }),
        }),
      )
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'finance.term.create' }) }),
      )
      expect(result.termNumber).toBe(1)
    })

    it('maps a unique constraint violation on a term to 409', async () => {
      prismaMock.academicSession.findUnique.mockResolvedValue(sessionRecord())
      prismaMock.academicTerm.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))

      await expect(
        createTerm(accountant, {
          sessionId: 's-1',
          name: 'First Term',
          termNumber: 1,
          startDate: '2025-09-01',
          endDate: '2025-12-19',
        }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.Conflict })
    })

    it('deactivates a term and keeps one ACTIVE term per session', async () => {
      prismaMock.academicTerm.findUnique.mockResolvedValue(termRecord())

      await setTermStatus(accountant, 't-1', 'INACTIVE')

      expect(prismaMock.academicTerm.update).toHaveBeenCalledWith({
        where: { id: 't-1' },
        data: { status: 'INACTIVE' },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'finance.term.deactivate' }) }),
      )
    })

    it('activates a term and demotes other ACTIVE terms in the session', async () => {
      prismaMock.academicTerm.findUnique.mockResolvedValue(termRecord('t-2', { status: 'INACTIVE' }))

      await setTermStatus(accountant, 't-2', 'ACTIVE')

      expect(prismaMock.academicTerm.updateMany).toHaveBeenCalledWith({
        where: { sessionId: 's-1', status: 'ACTIVE', id: { not: 't-2' } },
        data: { status: 'INACTIVE' },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'finance.term.activate' }) }),
      )
    })

    it('updates term fields and validates dates', async () => {
      prismaMock.academicTerm.findUnique.mockResolvedValue(termRecord())
      prismaMock.academicTerm.update.mockResolvedValue(termRecord())

      await updateTerm(accountant, 't-1', { schoolDays: 90, name: 'First Term' })

      expect(prismaMock.academicTerm.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 't-1' },
          data: expect.objectContaining({ schoolDays: 90, name: 'First Term' }),
        }),
      )

      await expect(updateTerm(accountant, 't-1', { startDate: '2025-09-01', endDate: '2025-08-01' })).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
      })
    })

    it('throws a 404 for a missing term', async () => {
      await expect(getTerm('missing')).rejects.toMatchObject({ statusCode: HttpStatus.NotFound })
    })

    it('lists terms optionally filtered by session', async () => {
      prismaMock.academicTerm.findMany.mockResolvedValue([termRecord()])
      const result = await listTerms('s-1')
      expect(prismaMock.academicTerm.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sessionId: 's-1' } }),
      )
      expect(result[0]).toMatchObject({ name: 'First Term', termNumber: 1, schoolDays: 80 })
    })
  })

  describe('fees', () => {
    it('creates a fee and audits it with the money as a string', async () => {
      prismaMock.academicSession.findUnique.mockResolvedValue(sessionRecord())
      prismaMock.financeFee.create.mockResolvedValue(feeRecord())
      setupFeeLookup()

      const result = await createFee(accountant, {
        sessionId: 's-1',
        name: 'Tuition',
        feeType: 'TERMLY',
        amount: '120.50',
      })

      expect(prismaMock.financeFee.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: 's-1',
          name: 'Tuition',
          feeType: 'TERMLY',
          amount: expect.any(Prisma.Decimal),
        }),
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'finance.fee.create',
            metadata: expect.objectContaining({ amount: '120.50' }),
          }),
        }),
      )
      expect(result.amount).toBe('120.50')
    })

    it('maps a duplicate fee name in a session to 409', async () => {
      prismaMock.academicSession.findUnique.mockResolvedValue(sessionRecord())
      prismaMock.financeFee.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 'P2002' }))

      await expect(
        createFee(accountant, { sessionId: 's-1', name: 'Tuition', feeType: 'TERMLY', amount: '100.00' }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.Conflict })
    })

    it('rejects creating a fee for a missing session', async () => {
      prismaMock.academicSession.findUnique.mockResolvedValue(null)
      await expect(
        createFee(accountant, { sessionId: 'missing', name: 'Tuition', feeType: 'TERMLY', amount: '100.00' }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.NotFound })
    })

    it('updates fee fields and audits the changed fields', async () => {
      prismaMock.financeFee.findUnique.mockResolvedValue(feeRecord())
      prismaMock.financeFee.update.mockResolvedValue(feeRecord())

      await updateFee(accountant, 'f-1', { amount: '150.00', description: 'Includes exams' })

      expect(prismaMock.financeFee.update).toHaveBeenCalledWith({
        where: { id: 'f-1' },
        data: expect.objectContaining({ amount: expect.any(Prisma.Decimal), description: 'Includes exams' }),
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'finance.fee.update',
            metadata: expect.objectContaining({ changed: expect.arrayContaining(['amount', 'description']) }),
          }),
        }),
      )
    })

    it('deactivating a fee preserves charges and audits the action', async () => {
      prismaMock.financeFee.findUnique.mockResolvedValue(feeRecord())
      prismaMock.financeFee.update.mockResolvedValue(feeRecord())

      await setFeeStatus(accountant, 'f-1', 'INACTIVE')

      expect(prismaMock.financeFee.update).toHaveBeenCalledWith({
        where: { id: 'f-1' },
        data: { status: 'INACTIVE' },
      })
      expect(prismaMock.feeCharge.updateMany).not.toHaveBeenCalled()
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'finance.fee.deactivate' }) }),
      )
    })

    it('lists fees with assignment and charge counts', async () => {
      prismaMock.financeFee.findMany.mockResolvedValue([feeRecord()])
      const result = await listFees({ sessionId: 's-1', status: 'ACTIVE' })
      expect(prismaMock.financeFee.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sessionId: 's-1', status: 'ACTIVE' } }),
      )
      expect(result[0]).toMatchObject({
        name: 'Tuition',
        amount: '120.50',
        sessionName: '2025/2026 Academic Year',
        assignmentCount: 2,
        activeAssignmentCount: 1,
        chargeCount: 3,
      })
    })
  })

  describe('assignments', () => {
    it('assigns new pupils and skips already-assigned ones', async () => {
      prismaMock.financeFee.findUnique.mockResolvedValue(feeRecord())
      prismaMock.pupil.findMany.mockResolvedValue([{ id: 'p-1' }, { id: 'p-2' }])
      prismaMock.feeAssignment.findMany.mockResolvedValue([{ pupilId: 'p-1' }])
      prismaMock.feeAssignment.createMany.mockResolvedValue({ count: 1 })

      const result = await assignPupilsToFee(accountant, 'f-1', { pupilIds: ['p-1', 'p-2', 'p-1'] })

      expect(prismaMock.feeAssignment.createMany).toHaveBeenCalledWith({
        data: [{ pupilId: 'p-2', feeId: 'f-1' }],
        skipDuplicates: true,
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'finance.fee.assign' }) }),
      )
      expect(result).toEqual({ assigned: 1, skipped: 1 })
    })

    it('rejects assigning unknown pupils', async () => {
      prismaMock.financeFee.findUnique.mockResolvedValue(feeRecord())
      prismaMock.pupil.findMany.mockResolvedValue([{ id: 'p-1' }])

      await expect(assignPupilsToFee(accountant, 'f-1', { pupilIds: ['p-1', 'ghost'] })).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
      })
    })

    it('deactivates an assignment and cancels outstanding charges without allocations', async () => {
      prismaMock.feeAssignment.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === 'a-1' ? assignmentRecord() : null,
      )
      prismaMock.feeAssignment.update.mockResolvedValue(assignmentRecord())
      prismaMock.feeCharge.findMany.mockResolvedValue([{ id: 'c-1' }, { id: 'c-2' }])
      prismaMock.feeCharge.updateMany.mockResolvedValue({ count: 2 })

      await deactivateAssignment(accountant, 'a-1')

      expect(prismaMock.feeAssignment.update).toHaveBeenCalledWith({
        where: { id: 'a-1' },
        data: { status: 'INACTIVE' },
      })
      expect(prismaMock.feeCharge.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: { in: ['c-1', 'c-2'] } },
          data: expect.objectContaining({
            status: 'CANCELLED',
            cancelledById: 'acc-1',
            cancelReason: 'Fee assignment deactivated',
          }),
        }),
      )
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'finance.fee.assign_deactivate' }) }),
      )
    })

    it('is a no-op for an already-inactive assignment', async () => {
      prismaMock.feeAssignment.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
        where.id === 'a-1' ? assignmentRecord('a-1', { status: 'INACTIVE' }) : null,
      )

      await deactivateAssignment(accountant, 'a-1')

      expect(prismaMock.feeAssignment.update).not.toHaveBeenCalled()
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
    })
  })

  describe('charge generation', () => {
    beforeEach(() => {
      prismaMock.financeFee.findUnique.mockResolvedValue(feeRecord())
      prismaMock.feeAssignment.findMany.mockResolvedValue([{ id: 'a-1' }, { id: 'a-2' }])
      prismaMock.academicTerm.findMany.mockResolvedValue([termRecord(), termRecord('t-2', { termNumber: 2 })])
    })

    it('generates one TERMLY charge per active term per assignment', async () => {
      prismaMock.feeCharge.createMany.mockResolvedValue({ count: 4 })

      const result = await generateChargesForFee(accountant, 'f-1')

      expect(prismaMock.feeCharge.createMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          { assignmentId: 'a-1', termId: 't-1', amount: expect.any(Prisma.Decimal) },
          { assignmentId: 'a-2', termId: 't-2', amount: expect.any(Prisma.Decimal) },
        ]),
        skipDuplicates: true,
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'finance.charge.generate',
            metadata: expect.objectContaining({ feeId: 'f-1', created: 4 }),
          }),
        }),
      )
      expect(result.created).toBe(4)
    })

    it('multiplies DAILY fees by the term school days', async () => {
      prismaMock.financeFee.findUnique.mockResolvedValue(feeRecord('f-1', { feeType: 'DAILY', amount: new Prisma.Decimal('2.50') }))
      prismaMock.feeCharge.createMany.mockResolvedValue({ count: 4 })

      const result = await generateChargesForFee(accountant, 'f-1')

      expect(result.created).toBe(4)
      const createArgs = prismaMock.feeCharge.createMany.mock.calls[0][0]
      const daily = createArgs.data[0]
      expect(daily.amount.toFixed(2)).toBe('200.00')
    })

    it('rejects DAILY generation when a term has no school days', async () => {
      prismaMock.financeFee.findUnique.mockResolvedValue(feeRecord('f-1', { feeType: 'DAILY' }))
      prismaMock.academicTerm.findMany.mockResolvedValue([termRecord('t-1', { schoolDays: 0 })])

      await expect(generateChargesForFee(accountant, 'f-1')).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
      })
    })

    it('creates a single OTHER charge per assignment and skips duplicates', async () => {
      prismaMock.financeFee.findUnique.mockResolvedValue(feeRecord('f-1', { feeType: 'OTHER' }))
      prismaMock.feeCharge.findFirst.mockResolvedValue(null)
      prismaMock.feeCharge.create.mockResolvedValue({ id: 'c-new' })

      const first = await generateChargesForFee(accountant, 'f-1')
      expect(first.created).toBe(2)
      expect(prismaMock.feeCharge.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ assignmentId: 'a-1', termId: null, amount: expect.any(Prisma.Decimal) }),
      })

      prismaMock.feeCharge.findFirst.mockResolvedValue({ id: 'c-exists' })
      const second = await generateChargesForFee(accountant, 'f-1')
      expect(second.created).toBe(0)
    })

    it('generates charges for every active fee in a session with a single audit entry', async () => {
      prismaMock.academicSession.findUnique.mockResolvedValue(sessionRecord())
      prismaMock.financeFee.findMany.mockResolvedValue([{ id: 'f-1' }, { id: 'f-2' }])
      prismaMock.feeCharge.createMany.mockResolvedValue({ count: 2 })

      const result = await generateChargesForSession(accountant, 's-1')

      expect(prismaMock.financeFee.findMany).toHaveBeenCalledWith({
        where: { sessionId: 's-1', status: 'ACTIVE' },
        select: { id: true },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1)
      expect(result.created).toBe(4)
    })
  })

  describe('payments', () => {
    const autoCharge = (id = 'c-1', overrides: Record<string, unknown> = {}) => chargeRecord(id, overrides)

    beforeEach(() => {
      prismaMock.pupil.findUnique.mockResolvedValue({ id: 'p-1', pupilId: 'PRPS-PUP-0001' })
      prismaMock.payment.count.mockResolvedValue(0)
      prismaMock.payment.create.mockResolvedValue(paymentRecord())
    })

    it('auto-allocates a full payment across the pupil\'s outstanding charges', async () => {
      prismaMock.feeCharge.findMany.mockResolvedValue([
        autoCharge('c-1', { amount: new Prisma.Decimal('100.00') }),
        autoCharge('c-2', { amount: new Prisma.Decimal('20.50') }),
      ])

      const result = await createPayment(accountant, {
        pupilId: 'p-1',
        amountPaid: '120.50',
        paymentMethod: 'CASH',
      })

      expect(prismaMock.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            paymentReference: 'PRPS-PAY-000001',
            receivedById: 'acc-1',
            allocations: {
              create: [
                { chargeId: 'c-1', amount: expect.any(Prisma.Decimal) },
                { chargeId: 'c-2', amount: expect.any(Prisma.Decimal) },
              ],
            },
          }),
        }),
      )
      const data = prismaMock.payment.create.mock.calls[0][0].data
      expect(data.allocations.create[0].amount.toFixed(2)).toBe('100.00')
      expect(data.allocations.create[1].amount.toFixed(2)).toBe('20.50')
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'finance.payment.create',
            metadata: expect.objectContaining({ paymentReference: 'PRPS-PAY-000001', amountPaid: '120.50' }),
          }),
        }),
      )
      expect(result.paymentReference).toBe('PRPS-PAY-000001')
    })

    it('auto-allocates a partial payment and leaves a balance', async () => {
      prismaMock.feeCharge.findMany.mockResolvedValue([autoCharge('c-1', { amount: new Prisma.Decimal('300.00') })])

      await createPayment(accountant, {
        pupilId: 'p-1',
        amountPaid: '120.50',
        paymentMethod: 'MOBILE_MONEY',
      })

      const data = prismaMock.payment.create.mock.calls[0][0].data
      expect(data.allocations.create).toEqual([{ chargeId: 'c-1', amount: expect.any(Prisma.Decimal) }])
      expect(data.allocations.create[0].amount.toFixed(2)).toBe('120.50')
    })

    it('rejects a payment that exceeds the outstanding balance', async () => {
      prismaMock.feeCharge.findMany.mockResolvedValue([autoCharge('c-1', { amount: new Prisma.Decimal('100.00') })])

      await expect(
        createPayment(accountant, { pupilId: 'p-1', amountPaid: '150.00', paymentMethod: 'CASH' }),
      ).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
        message: expect.stringMatching(/exceeds/),
      })
    })

    it('rejects a payment when the pupil has no outstanding charges', async () => {
      prismaMock.feeCharge.findMany.mockResolvedValue([])

      await expect(
        createPayment(accountant, { pupilId: 'p-1', amountPaid: '10.00', paymentMethod: 'CASH' }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.BadRequest })
    })

    it('honours explicit allocations and validates they total the payment amount', async () => {
      prismaMock.feeCharge.findMany.mockResolvedValue([autoCharge('c-1', { amount: new Prisma.Decimal('200.00') })])

      await createPayment(accountant, {
        pupilId: 'p-1',
        amountPaid: '120.50',
        paymentMethod: 'CASH',
        allocations: [{ chargeId: 'c-1', amount: '120.50' }],
      })

      const data = prismaMock.payment.create.mock.calls[0][0].data
      expect(data.allocations.create).toEqual([{ chargeId: 'c-1', amount: expect.any(Prisma.Decimal) }])

      await expect(
        createPayment(accountant, {
          pupilId: 'p-1',
          amountPaid: '100.00',
          paymentMethod: 'CASH',
          allocations: [{ chargeId: 'c-1', amount: '120.50' }],
        }),
      ).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
        message: expect.stringMatching(/total/),
      })
    })

    it('rejects an explicit allocation that exceeds the charge balance', async () => {
      prismaMock.feeCharge.findMany.mockResolvedValue([autoCharge('c-1', { amount: new Prisma.Decimal('100.00') })])

      await expect(
        createPayment(accountant, {
          pupilId: 'p-1',
          amountPaid: '100.00',
          paymentMethod: 'CASH',
          allocations: [{ chargeId: 'c-1', amount: '150.00' }],
        }),
      ).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
        message: expect.stringMatching(/outstanding balance/),
      })
    })

    it('retries with the next reference number on a unique reference collision', async () => {
      prismaMock.feeCharge.findMany.mockResolvedValue([autoCharge('c-1', { amount: new Prisma.Decimal('100.00') })])
      prismaMock.payment.create
        .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 'P2002' }))
        .mockResolvedValueOnce(paymentRecord('pay-2', { paymentReference: 'PRPS-PAY-000002' }))

      const result = await createPayment(accountant, {
        pupilId: 'p-1',
        amountPaid: '100.00',
        paymentMethod: 'CASH',
      })

      expect(prismaMock.payment.create).toHaveBeenCalledTimes(2)
      expect(prismaMock.payment.create.mock.calls[1][0].data.paymentReference).toBe('PRPS-PAY-000002')
      expect(result.paymentReference).toBe('PRPS-PAY-000002')
    })

    it('never exposes sensitive data in payment views', async () => {
      prismaMock.feeCharge.findMany.mockResolvedValue([autoCharge('c-1', { amount: new Prisma.Decimal('100.00') })])
      const result = await createPayment(accountant, {
        pupilId: 'p-1',
        amountPaid: '100.00',
        paymentMethod: 'CASH',
      })
      expect(JSON.stringify(result)).not.toContain('password')
      expect(JSON.stringify(result)).not.toContain('token')
    })

    it('voids a payment, reverses its allocations and audits the action', async () => {
      prismaMock.payment.findUnique
        .mockReturnValueOnce(paymentRecord('pay-1', { voidedById: null }))
        .mockResolvedValue(
          paymentRecord('pay-1', { status: 'VOIDED', voidedById: 'acc-1', voidReason: 'Entered in error' }),
        )
      prismaMock.payment.update.mockResolvedValue(
        paymentRecord('pay-1', { status: 'VOIDED', voidedById: 'acc-1', voidReason: 'Entered in error' }),
      )
      prismaMock.paymentAllocation.deleteMany.mockResolvedValue({ count: 1 })

      const result = await voidPayment(accountant, 'pay-1', { reason: 'Entered in error' })

      expect(prismaMock.paymentAllocation.deleteMany).toHaveBeenCalledWith({ where: { paymentId: 'pay-1' } })
      expect(prismaMock.payment.update).toHaveBeenCalledWith({
        where: { id: 'pay-1' },
        data: expect.objectContaining({ status: 'VOIDED', voidedById: 'acc-1', voidReason: 'Entered in error' }),
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'finance.payment.void',
            metadata: expect.objectContaining({ paymentReference: 'PRPS-PAY-000001', reason: 'Entered in error' }),
          }),
        }),
      )
      expect(result.status).toBe('VOIDED')
    })

    it('rejects voiding an already-voided payment', async () => {
      prismaMock.payment.findUnique.mockResolvedValue(
        paymentRecord('pay-1', { status: 'VOIDED', voidReason: 'Already' }),
      )

      await expect(voidPayment(accountant, 'pay-1', { reason: 'Again' })).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
      })
    })

    it('lists payments with pagination and resolves recorder names', async () => {
      prismaMock.payment.count.mockResolvedValue(1)
      prismaMock.payment.findMany.mockResolvedValue([paymentRecord()])
      prismaMock.user.findMany.mockResolvedValue([{ id: 'acc-1', fullName: 'Ama Mensah' }])

      const result = await listPayments({ q: 'ama', status: 'ACTIVE', page: 1, pageSize: 20 })

      expect(prismaMock.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ACTIVE', OR: expect.any(Array) }),
          take: 20,
          skip: 0,
        }),
      )
      expect(result.total).toBe(1)
      expect(result.items[0].receivedByName).toBe('Ama Mensah')
      expect(result.items[0].amountPaid).toBe('120.50')
    })
  })

  describe('pupil finance', () => {
    it('computes charges, payments and balances for a pupil', async () => {
      prismaMock.pupil.findUnique.mockResolvedValue({
        id: 'p-1',
        pupilId: 'PRPS-PUP-0001',
        firstName: 'Ama',
        lastName: 'Owusu',
        class: { name: 'Primary 1' },
      })
      prismaMock.feeCharge.findMany.mockResolvedValue([
        chargeRecord('c-1', {
          amount: new Prisma.Decimal('120.50'),
          allocations: [{ amount: new Prisma.Decimal('120.50') }],
        }),
        chargeRecord('c-2', { amount: new Prisma.Decimal('80.00'), allocations: [] }),
      ])
      prismaMock.payment.findMany.mockResolvedValue([
        paymentRecord(),
        paymentRecord('pay-2', {
          paymentReference: 'PRPS-PAY-000002',
          status: 'VOIDED',
          voidedById: 'acc-1',
          voidReason: 'Entered in error',
          allocations: [],
        }),
      ])

      const result = await getPupilFinance('p-1')

      expect(result.pupil).toMatchObject({ pupilId: 'PRPS-PUP-0001', fullName: 'Ama Owusu' })
      expect(result.totalDue).toBe('200.50')
      expect(result.totalPaid).toBe('120.50')
      expect(result.outstanding).toBe('80.00')
      expect(result.charges).toHaveLength(2)
      expect(result.charges[0]).toMatchObject({ feeName: 'Tuition', termName: 'First Term', balance: '0.00' })
      expect(result.charges[1].balance).toBe('80.00')
      expect(result.payments).toHaveLength(2)
      expect(result.payments[1].status).toBe('VOIDED')
    })

    it('excludes voided payments from collected balances', async () => {
      prismaMock.pupil.findUnique.mockResolvedValue({
        id: 'p-1',
        pupilId: 'PRPS-PUP-0001',
        firstName: 'Ama',
        lastName: 'Owusu',
        class: { name: 'Primary 1' },
      })
      prismaMock.feeCharge.findMany.mockResolvedValue([
        chargeRecord('c-1', { amount: new Prisma.Decimal('120.50'), allocations: [] }),
      ])
      prismaMock.payment.findMany.mockResolvedValue([
        paymentRecord('pay-2', { status: 'VOIDED', allocations: [] }),
      ])

      const result = await getPupilFinance('p-1')

      expect(result.totalPaid).toBe('0.00')
      expect(result.outstanding).toBe('120.50')
    })

    it('throws a 404 for a missing pupil', async () => {
      prismaMock.pupil.findUnique.mockResolvedValue(null)
      await expect(getPupilFinance('missing')).rejects.toMatchObject({ statusCode: HttpStatus.NotFound })
    })
  })

  describe('finance summary', () => {
    it('aggregates expected, collected, outstanding and term payments', async () => {
      prismaMock.academicSession.findFirst.mockResolvedValue(sessionRecord())
      prismaMock.academicTerm.findFirst.mockResolvedValue(termRecord())
      prismaMock.feeCharge.aggregate.mockResolvedValue({ _sum: { amount: new Prisma.Decimal('1000.00') } })
      prismaMock.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amountPaid: new Prisma.Decimal('400.00') } })
        .mockResolvedValue({ _sum: { amountPaid: null }, _count: 0 })
      prismaMock.financeFee.findMany.mockResolvedValue([
        { feeType: 'TERMLY', status: 'ACTIVE' },
        { feeType: 'DAILY', status: 'ACTIVE' },
        { feeType: 'DAILY', status: 'INACTIVE' },
        { feeType: 'OTHER', status: 'ACTIVE' },
      ])
      prismaMock.feeCharge.findMany.mockResolvedValue([
        {
          amount: new Prisma.Decimal('100.00'),
          assignment: { pupilId: 'p-1' },
          allocations: [{ amount: new Prisma.Decimal('100.00') }],
        },
        {
          amount: new Prisma.Decimal('50.00'),
          assignment: { pupilId: 'p-2' },
          allocations: [],
        },
      ])
      prismaMock.payment.findMany.mockResolvedValue([])

      const summary = await getFinanceSummary()

      expect(summary.session).toMatchObject({ name: '2025/2026 Academic Year' })
      expect(summary.term).toMatchObject({ name: 'First Term' })
      expect(summary.expectedFees).toBe('1000.00')
      expect(summary.collected).toBe('400.00')
      expect(summary.outstanding).toBe('600.00')
      expect(summary.pupilsWithOutstanding).toBe(1)
      expect(summary.feeSummary).toEqual({ total: 4, active: 3, byType: { TERMLY: 1, DAILY: 2, OTHER: 1 } })
      expect(summary.paymentsThisTerm).toBe('0.00')
      expect(summary.paymentsThisTermCount).toBe(0)
    })
  })
})