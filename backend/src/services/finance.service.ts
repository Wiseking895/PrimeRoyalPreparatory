import { Prisma } from '@prisma/client'
import { HttpStatus } from '../config/enums'
import { prisma } from '../lib/prisma'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import {
  money,
  toFeeView,
  toPaymentView,
  toSessionView,
  toTermView,
  type AccountStatusValue,
  type AcademicSessionView,
  type AcademicTermView,
  type AssignFeesResult,
  type ChargeGenerateResult,
  type FeeAssignmentView,
  type FeeRecord,
  type FeeTypeValue,
  type FeeView,
  type FinancePupilView,
  type FinanceSummaryView,
  type PaymentMethodValue,
  type PaymentRecordStatusValue,
  type PaymentView,
  type PupilChargeView,
  type PupilFinanceView,
} from './finance-mapper'

/**
 * Phase 5 finance domain service.
 *
 * Sessions, terms, fee structures, pupil assignments, materialized charges,
 * payments and balances. Money is handled exclusively with Prisma.Decimal
 * (decimal.js) and exposed as fixed two-decimal strings, so GHS amounts never
 * lose precision.
 *
 * Financial truth is immutable-by-convention: charges are cancelled (never
 * deleted) and payments are voided (never deleted), each with an actor and a
 * reason recorded in the audit trail.
 */

export type SessionStatusValue = AccountStatusValue

export interface SessionCreateInput {
  name: string
  startDate: string
  endDate: string
  status?: SessionStatusValue
}

export interface SessionUpdateInput {
  name?: string
  startDate?: string
  endDate?: string
  status?: SessionStatusValue
}

export interface TermCreateInput {
  sessionId: string
  name: string
  termNumber: number
  startDate: string
  endDate: string
  schoolDays?: number
  status?: SessionStatusValue
}

export interface TermUpdateInput {
  name?: string
  termNumber?: number
  startDate?: string
  endDate?: string
  schoolDays?: number
  status?: SessionStatusValue
}

export interface FeeCreateInput {
  sessionId: string
  name: string
  feeType: FeeTypeValue
  amount: string
  description?: string
  status?: SessionStatusValue
}

export interface FeeUpdateInput {
  name?: string
  feeType?: FeeTypeValue
  amount?: string
  description?: string | null
  status?: SessionStatusValue
}

export interface FeeAssignInput {
  pupilIds: string[]
}

export interface PaymentAllocationInput {
  chargeId: string
  amount: string
}

export interface PaymentCreateInput {
  pupilId: string
  amountPaid: string
  paymentMethod: PaymentMethodValue
  paymentDate?: string
  note?: string
  allocations?: PaymentAllocationInput[]
}

export interface PaymentVoidInput {
  reason: string
}

export interface PaymentListOptions {
  q?: string
  pupilId?: string
  status?: PaymentRecordStatusValue
  paymentMethod?: PaymentMethodValue
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export interface PaymentListResult {
  items: PaymentView[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface PupilBalanceView extends FinancePupilView {
  totalDue: string
  totalPaid: string
  outstanding: string
  chargeCount: number
}

export interface FinancePupilListResult {
  items: PupilBalanceView[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string }).code === 'P2002'
}

function assertEndAfterStart(start: Date, end: Date): void {
  if (end.getTime() <= start.getTime()) {
    throw new AppError('The end date must be after the start date.', HttpStatus.BadRequest)
  }
}

function sumDecimal(values: Prisma.Decimal[]): Prisma.Decimal {
  return values.reduce((total, value) => total.plus(value), new Prisma.Decimal(0))
}

const sessionCountsInclude = {
  _count: { select: { terms: true, fees: true } },
} as const

const paymentInclude = {
  pupil: { select: { id: true, pupilId: true, firstName: true, lastName: true } },
  allocations: {
    include: {
      charge: {
        include: {
          assignment: { include: { fee: { select: { id: true, name: true } } } },
          term: { select: { id: true, name: true } },
        },
      },
    },
  },
} as const

async function resolveUserNames(ids: Array<string | null | undefined>): Promise<Record<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))]
  if (unique.length === 0) return {}
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, fullName: true },
  })
  return Object.fromEntries(users.map((user) => [user.id, user.fullName]))
}

// =============================================================================
// Sessions
// =============================================================================

export async function listSessions(): Promise<AcademicSessionView[]> {
  const sessions = await prisma.academicSession.findMany({
    include: sessionCountsInclude,
    orderBy: { startDate: 'asc' },
  })
  return sessions.map(toSessionView)
}

export async function getSession(id: string): Promise<AcademicSessionView> {
  const session = await prisma.academicSession.findUnique({
    where: { id },
    include: sessionCountsInclude,
  })
  if (!session) {
    throw new AppError('Academic session not found.', HttpStatus.NotFound)
  }
  return toSessionView(session)
}

export async function createSession(
  actor: AuthenticatedUser,
  input: SessionCreateInput,
  ip?: string,
): Promise<AcademicSessionView> {
  const name = input.name.trim()
  const startDate = new Date(input.startDate)
  const endDate = new Date(input.endDate)
  assertEndAfterStart(startDate, endDate)

  const duplicate = await prisma.academicSession.findUnique({ where: { name } })
  if (duplicate) {
    throw new AppError('A session with this name already exists.', HttpStatus.Conflict)
  }

  const status = input.status ?? 'ACTIVE'
  const session = await prisma.$transaction(async (tx) => {
    if (status === 'ACTIVE') {
      await tx.academicSession.updateMany({ where: { status: 'ACTIVE' }, data: { status: 'INACTIVE' } })
    }
    return tx.academicSession.create({ data: { name, startDate, endDate, status } })
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'finance.session.create',
    resourceType: 'academicSession',
    resourceId: session.id,
    metadata: { name, status },
    ip: ip ?? null,
  })

  return getSession(session.id)
}

export async function updateSession(
  actor: AuthenticatedUser,
  id: string,
  input: SessionUpdateInput,
  ip?: string,
): Promise<AcademicSessionView> {
  const existing = await prisma.academicSession.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Academic session not found.', HttpStatus.NotFound)
  }

  const data: Prisma.AcademicSessionUpdateInput = {}
  const changed: string[] = []

  if (input.name !== undefined) {
    const name = input.name.trim()
    const duplicate = await prisma.academicSession.findUnique({ where: { name } })
    if (duplicate && duplicate.id !== id) {
      throw new AppError('A session with this name already exists.', HttpStatus.Conflict)
    }
    data.name = name
    changed.push('name')
  }
  if (input.startDate !== undefined || input.endDate !== undefined) {
    const startDate = input.startDate ? new Date(input.startDate) : existing.startDate
    const endDate = input.endDate ? new Date(input.endDate) : existing.endDate
    assertEndAfterStart(startDate, endDate)
    if (input.startDate !== undefined) {
      data.startDate = startDate
      changed.push('startDate')
    }
    if (input.endDate !== undefined) {
      data.endDate = endDate
      changed.push('endDate')
    }
  }

  const targetStatus = input.status ?? existing.status
  const statusChanged = input.status !== undefined && input.status !== existing.status

  await prisma.$transaction(async (tx) => {
    if (targetStatus === 'ACTIVE') {
      await tx.academicSession.updateMany({
        where: { id: { not: id }, status: 'ACTIVE' },
        data: { status: 'INACTIVE' },
      })
    }
    await tx.academicSession.update({
      where: { id },
      data: { ...data, ...(input.status !== undefined ? { status: input.status } : {}) },
    })
  })
  if (statusChanged) changed.push('status')

  if (changed.length > 0) {
    await recordAudit({
      actorUserId: actor.id,
      action: 'finance.session.update',
      resourceType: 'academicSession',
      resourceId: id,
      metadata: { changed, name: data.name ?? existing.name },
      ip: ip ?? null,
    })
  }

  return getSession(id)
}

export async function setSessionStatus(
  actor: AuthenticatedUser,
  id: string,
  status: SessionStatusValue,
  ip?: string,
): Promise<AcademicSessionView> {
  const existing = await prisma.academicSession.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Academic session not found.', HttpStatus.NotFound)
  }

  if (existing.status !== status) {
    await prisma.$transaction(async (tx) => {
      if (status === 'ACTIVE') {
        await tx.academicSession.updateMany({
          where: { id: { not: id }, status: 'ACTIVE' },
          data: { status: 'INACTIVE' },
        })
      }
      await tx.academicSession.update({ where: { id }, data: { status } })
    })
    await recordAudit({
      actorUserId: actor.id,
      action: status === 'ACTIVE' ? 'finance.session.activate' : 'finance.session.deactivate',
      resourceType: 'academicSession',
      resourceId: id,
      metadata: { name: existing.name },
      ip: ip ?? null,
    })
  }

  return getSession(id)
}

// =============================================================================
// Terms
// =============================================================================

export async function listTerms(sessionId?: string): Promise<AcademicTermView[]> {
  const where: Prisma.AcademicTermWhereInput = {}
  if (sessionId) where.sessionId = sessionId
  const terms = await prisma.academicTerm.findMany({
    where,
    orderBy: [{ sessionId: 'asc' }, { termNumber: 'asc' }],
  })
  return terms.map(toTermView)
}

export async function getTerm(id: string): Promise<AcademicTermView> {
  const term = await prisma.academicTerm.findUnique({ where: { id } })
  if (!term) {
    throw new AppError('Academic term not found.', HttpStatus.NotFound)
  }
  return toTermView(term)
}

export async function createTerm(
  actor: AuthenticatedUser,
  input: TermCreateInput,
  ip?: string,
): Promise<AcademicTermView> {
  const session = await prisma.academicSession.findUnique({ where: { id: input.sessionId } })
  if (!session) {
    throw new AppError('Academic session not found.', HttpStatus.NotFound)
  }

  const name = input.name.trim()
  const startDate = new Date(input.startDate)
  const endDate = new Date(input.endDate)
  assertEndAfterStart(startDate, endDate)

  const status = input.status ?? 'ACTIVE'
  let term
  try {
    term = await prisma.$transaction(async (tx) => {
      if (status === 'ACTIVE') {
        await tx.academicTerm.updateMany({
          where: { sessionId: input.sessionId, status: 'ACTIVE' },
          data: { status: 'INACTIVE' },
        })
      }
      return tx.academicTerm.create({
        data: {
          sessionId: input.sessionId,
          name,
          termNumber: input.termNumber,
          startDate,
          endDate,
          schoolDays: input.schoolDays ?? 0,
          status,
        },
      })
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        'A term with this name or term number already exists in the session.',
        HttpStatus.Conflict,
      )
    }
    throw error
  }

  await recordAudit({
    actorUserId: actor.id,
    action: 'finance.term.create',
    resourceType: 'academicTerm',
    resourceId: term.id,
    metadata: { sessionId: input.sessionId, name, termNumber: input.termNumber, status },
    ip: ip ?? null,
  })

  return getTerm(term.id)
}

export async function updateTerm(
  actor: AuthenticatedUser,
  id: string,
  input: TermUpdateInput,
  ip?: string,
): Promise<AcademicTermView> {
  const existing = await prisma.academicTerm.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Academic term not found.', HttpStatus.NotFound)
  }

  const data: Prisma.AcademicTermUpdateInput = {}
  const changed: string[] = []

  if (input.name !== undefined) {
    data.name = input.name.trim()
    changed.push('name')
  }
  if (input.termNumber !== undefined) {
    data.termNumber = input.termNumber
    changed.push('termNumber')
  }
  if (input.schoolDays !== undefined) {
    data.schoolDays = input.schoolDays
    changed.push('schoolDays')
  }
  if (input.startDate !== undefined || input.endDate !== undefined) {
    const startDate = input.startDate ? new Date(input.startDate) : existing.startDate
    const endDate = input.endDate ? new Date(input.endDate) : existing.endDate
    assertEndAfterStart(startDate, endDate)
    if (input.startDate !== undefined) {
      data.startDate = startDate
      changed.push('startDate')
    }
    if (input.endDate !== undefined) {
      data.endDate = endDate
      changed.push('endDate')
    }
  }

  const targetStatus = input.status ?? existing.status
  const statusChanged = input.status !== undefined && input.status !== existing.status

  try {
    await prisma.$transaction(async (tx) => {
      if (targetStatus === 'ACTIVE') {
        await tx.academicTerm.updateMany({
          where: { sessionId: existing.sessionId, status: 'ACTIVE', id: { not: id } },
          data: { status: 'INACTIVE' },
        })
      }
      await tx.academicTerm.update({
        where: { id },
        data: { ...data, ...(input.status !== undefined ? { status: input.status } : {}) },
      })
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError(
        'A term with this name or term number already exists in the session.',
        HttpStatus.Conflict,
      )
    }
    throw error
  }
  if (statusChanged) changed.push('status')

  if (changed.length > 0) {
    await recordAudit({
      actorUserId: actor.id,
      action: 'finance.term.update',
      resourceType: 'academicTerm',
      resourceId: id,
      metadata: { changed },
      ip: ip ?? null,
    })
  }

  return getTerm(id)
}

export async function setTermStatus(
  actor: AuthenticatedUser,
  id: string,
  status: SessionStatusValue,
  ip?: string,
): Promise<AcademicTermView> {
  const existing = await prisma.academicTerm.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Academic term not found.', HttpStatus.NotFound)
  }

  if (existing.status !== status) {
    await prisma.$transaction(async (tx) => {
      if (status === 'ACTIVE') {
        await tx.academicTerm.updateMany({
          where: { sessionId: existing.sessionId, status: 'ACTIVE', id: { not: id } },
          data: { status: 'INACTIVE' },
        })
      }
      await tx.academicTerm.update({ where: { id }, data: { status } })
    })
    await recordAudit({
      actorUserId: actor.id,
      action: status === 'ACTIVE' ? 'finance.term.activate' : 'finance.term.deactivate',
      resourceType: 'academicTerm',
      resourceId: id,
      metadata: { sessionId: existing.sessionId, name: existing.name },
      ip: ip ?? null,
    })
  }

  return getTerm(id)
}

// =============================================================================
// Fee structures
// =============================================================================

const feeInclude = {
  session: { select: { name: true } },
  assignments: { where: { status: 'ACTIVE' }, select: { id: true } },
  _count: { select: { assignments: true, charges: true } },
} as const

function toFeeViewRecord(fee: Prisma.FinanceFeeGetPayload<{ include: typeof feeInclude }>): FeeRecord {
  return {
    id: fee.id,
    sessionId: fee.sessionId,
    sessionName: fee.session.name,
    name: fee.name,
    feeType: fee.feeType,
    amount: fee.amount,
    description: fee.description,
    status: fee.status,
    createdAt: fee.createdAt,
    updatedAt: fee.updatedAt,
    assignmentCount: fee._count.assignments,
    activeAssignmentCount: fee.assignments.length,
    chargeCount: fee._count.charges,
  }
}

export async function listFees(options: { sessionId?: string; status?: SessionStatusValue } = {}): Promise<FeeView[]> {
  const where: Prisma.FinanceFeeWhereInput = {}
  if (options.sessionId) where.sessionId = options.sessionId
  if (options.status) where.status = options.status
  const fees = await prisma.financeFee.findMany({
    where,
    include: feeInclude,
    orderBy: [{ createdAt: 'desc' }],
  })
  return fees.map((fee) => toFeeView(toFeeViewRecord(fee)))
}

export async function getFee(id: string): Promise<FeeView> {
  const fee = await prisma.financeFee.findUnique({ where: { id }, include: feeInclude })
  if (!fee) {
    throw new AppError('Fee not found.', HttpStatus.NotFound)
  }
  return toFeeView(toFeeViewRecord(fee))
}

export async function createFee(
  actor: AuthenticatedUser,
  input: FeeCreateInput,
  ip?: string,
): Promise<FeeView> {
  const session = await prisma.academicSession.findUnique({ where: { id: input.sessionId } })
  if (!session) {
    throw new AppError('Academic session not found.', HttpStatus.NotFound)
  }

  const fee = await prisma.financeFee.create({
    data: {
      sessionId: input.sessionId,
      name: input.name.trim(),
      feeType: input.feeType,
      amount: new Prisma.Decimal(input.amount),
      description: input.description?.trim() || null,
      status: input.status ?? 'ACTIVE',
    },
  }).catch((error: unknown) => {
    if (isUniqueViolation(error)) {
      throw new AppError('A fee with this name already exists in the session.', HttpStatus.Conflict)
    }
    throw error
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'finance.fee.create',
    resourceType: 'financeFee',
    resourceId: fee.id,
    metadata: { sessionId: input.sessionId, name: fee.name, feeType: fee.feeType, amount: money(fee.amount) },
    ip: ip ?? null,
  })

  return getFee(fee.id)
}

export async function updateFee(
  actor: AuthenticatedUser,
  id: string,
  input: FeeUpdateInput,
  ip?: string,
): Promise<FeeView> {
  const existing = await prisma.financeFee.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Fee not found.', HttpStatus.NotFound)
  }

  const data: Prisma.FinanceFeeUpdateInput = {}
  const changed: string[] = []

  if (input.name !== undefined) {
    data.name = input.name.trim()
    changed.push('name')
  }
  if (input.feeType !== undefined) {
    data.feeType = input.feeType
    changed.push('feeType')
  }
  if (input.amount !== undefined) {
    data.amount = new Prisma.Decimal(input.amount)
    changed.push('amount')
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null
    changed.push('description')
  }
  if (input.status !== undefined && input.status !== existing.status) {
    data.status = input.status
    changed.push('status')
  }

  if (Object.keys(data).length > 0) {
    await prisma.financeFee.update({ where: { id }, data }).catch((error: unknown) => {
      if (isUniqueViolation(error)) {
        throw new AppError('A fee with this name already exists in the session.', HttpStatus.Conflict)
      }
      throw error
    })
  }

  if (changed.length > 0) {
    await recordAudit({
      actorUserId: actor.id,
      action: 'finance.fee.update',
      resourceType: 'financeFee',
      resourceId: id,
      metadata: { changed },
      ip: ip ?? null,
    })
  }

  return getFee(id)
}

export async function setFeeStatus(
  actor: AuthenticatedUser,
  id: string,
  status: SessionStatusValue,
  ip?: string,
): Promise<FeeView> {
  const existing = await prisma.financeFee.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Fee not found.', HttpStatus.NotFound)
  }

  if (existing.status !== status) {
    await prisma.financeFee.update({ where: { id }, data: { status } })
    await recordAudit({
      actorUserId: actor.id,
      action: status === 'ACTIVE' ? 'finance.fee.activate' : 'finance.fee.deactivate',
      resourceType: 'financeFee',
      resourceId: id,
      metadata: { name: existing.name },
      ip: ip ?? null,
    })
  }

  return getFee(id)
}

// =============================================================================
// Fee assignments
// =============================================================================

const assignmentInclude = {
  pupil: {
    include: { class: { select: { name: true } } },
  },
  fee: { select: { name: true } },
  _count: { select: { charges: true } },
} as const

function toAssignmentView(
  assignment: Prisma.FeeAssignmentGetPayload<{ include: typeof assignmentInclude }>,
): FeeAssignmentView {
  return {
    id: assignment.id,
    pupilId: assignment.pupilId,
    pupilCode: assignment.pupil.pupilId,
    pupilName: `${assignment.pupil.firstName} ${assignment.pupil.lastName}`.trim(),
    className: assignment.pupil.class.name,
    feeId: assignment.feeId,
    feeName: assignment.fee.name,
    status: assignment.status,
    chargeCount: assignment._count.charges,
    createdAt: assignment.createdAt.toISOString(),
  }
}

export async function listFeeAssignments(feeId: string): Promise<FeeAssignmentView[]> {
  const fee = await prisma.financeFee.findUnique({ where: { id: feeId }, select: { id: true } })
  if (!fee) {
    throw new AppError('Fee not found.', HttpStatus.NotFound)
  }
  const assignments = await prisma.feeAssignment.findMany({
    where: { feeId },
    include: assignmentInclude,
    orderBy: { createdAt: 'desc' },
  })
  return assignments.map(toAssignmentView)
}

export async function getFeeAssignment(id: string): Promise<FeeAssignmentView> {
  const assignment = await prisma.feeAssignment.findUnique({ where: { id }, include: assignmentInclude })
  if (!assignment) {
    throw new AppError('Fee assignment not found.', HttpStatus.NotFound)
  }
  return toAssignmentView(assignment)
}

export async function assignPupilsToFee(
  actor: AuthenticatedUser,
  feeId: string,
  input: FeeAssignInput,
  ip?: string,
): Promise<AssignFeesResult> {
  const fee = await prisma.financeFee.findUnique({ where: { id: feeId } })
  if (!fee) {
    throw new AppError('Fee not found.', HttpStatus.NotFound)
  }

  const ids = [...new Set(input.pupilIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) {
    return { assigned: 0, skipped: 0 }
  }

  const pupils = await prisma.pupil.findMany({ where: { id: { in: ids } }, select: { id: true } })
  if (pupils.length !== ids.length) {
    throw new AppError('One or more selected pupils could not be found.', HttpStatus.BadRequest)
  }

  const existing = await prisma.feeAssignment.findMany({
    where: { feeId, pupilId: { in: ids } },
    select: { pupilId: true },
  })
  const alreadyAssigned = new Set(existing.map((row) => row.pupilId))
  const toCreate = ids.filter((id) => !alreadyAssigned.has(id))

  let assigned = 0
  if (toCreate.length > 0) {
    const result = await prisma.feeAssignment.createMany({
      data: toCreate.map((pupilId) => ({ pupilId, feeId })),
      skipDuplicates: true,
    })
    assigned = result.count
  }

  await recordAudit({
    actorUserId: actor.id,
    action: 'finance.fee.assign',
    resourceType: 'feeAssignment',
    resourceId: feeId,
    metadata: { feeId, feeName: fee.name, pupilIds: toCreate, assigned },
    ip: ip ?? null,
  })

  return { assigned, skipped: ids.length - assigned }
}

export async function deactivateAssignment(
  actor: AuthenticatedUser,
  assignmentId: string,
  ip?: string,
): Promise<FeeAssignmentView> {
  const assignment = await prisma.feeAssignment.findUnique({
    where: { id: assignmentId },
    include: { fee: { select: { name: true } }, pupil: { select: { pupilId: true } } },
  })
  if (!assignment) {
    throw new AppError('Fee assignment not found.', HttpStatus.NotFound)
  }

  if (assignment.status === 'ACTIVE') {
    await prisma.$transaction(async (tx) => {
      await tx.feeAssignment.update({ where: { id: assignmentId }, data: { status: 'INACTIVE' } })
      const outstanding = await tx.feeCharge.findMany({
        where: { assignmentId, status: 'ACTIVE', allocations: { none: {} } },
        select: { id: true },
      })
      if (outstanding.length > 0) {
        await tx.feeCharge.updateMany({
          where: { id: { in: outstanding.map((charge) => charge.id) } },
          data: {
            status: 'CANCELLED',
            cancelledAt: new Date(),
            cancelledById: actor.id,
            cancelReason: 'Fee assignment deactivated',
          },
        })
      }
    })
    await recordAudit({
      actorUserId: actor.id,
      action: 'finance.fee.assign_deactivate',
      resourceType: 'feeAssignment',
      resourceId: assignmentId,
      metadata: { feeName: assignment.fee.name, pupilId: assignment.pupil.pupilId },
      ip: ip ?? null,
    })
  }

  return getFeeAssignment(assignmentId)
}

// =============================================================================
// Charge generation
// =============================================================================

async function generateChargesForFeeInner(feeId: string): Promise<number> {
  const fee = await prisma.financeFee.findUnique({
    where: { id: feeId },
    include: { session: { select: { name: true } } },
  })
  if (!fee) {
    throw new AppError('Fee not found.', HttpStatus.NotFound)
  }

  const assignments = await prisma.feeAssignment.findMany({
    where: { feeId, status: 'ACTIVE' },
    select: { id: true },
  })
  if (assignments.length === 0) return 0

  if (fee.feeType === 'DAILY') {
    const terms = await prisma.academicTerm.findMany({
      where: { sessionId: fee.sessionId, status: 'ACTIVE' },
      select: { id: true, name: true, schoolDays: true },
      orderBy: { termNumber: 'asc' },
    })
    const invalidTerm = terms.find((term) => term.schoolDays <= 0)
    if (invalidTerm) {
      throw new AppError(
        `Term "${invalidTerm.name}" has no school days. Set the school day count before generating daily charges.`,
        HttpStatus.BadRequest,
      )
    }
    const rows: Array<{ assignmentId: string; termId: string; amount: Prisma.Decimal }> = []
    for (const assignment of assignments) {
      for (const term of terms) {
        rows.push({
          assignmentId: assignment.id,
          termId: term.id,
          amount: fee.amount.mul(term.schoolDays),
        })
      }
    }
    if (rows.length === 0) return 0
    const result = await prisma.feeCharge.createMany({ data: rows, skipDuplicates: true })
    return result.count
  }

  if (fee.feeType === 'TERMLY') {
    const terms = await prisma.academicTerm.findMany({
      where: { sessionId: fee.sessionId, status: 'ACTIVE' },
      select: { id: true },
      orderBy: { termNumber: 'asc' },
    })
    const rows: Array<{ assignmentId: string; termId: string; amount: Prisma.Decimal }> = []
    for (const assignment of assignments) {
      for (const term of terms) {
        rows.push({ assignmentId: assignment.id, termId: term.id, amount: fee.amount })
      }
    }
    if (rows.length === 0) return 0
    const result = await prisma.feeCharge.createMany({ data: rows, skipDuplicates: true })
    return result.count
  }

  let created = 0
  for (const assignment of assignments) {
    const existing = await prisma.feeCharge.findFirst({
      where: { assignmentId: assignment.id, termId: null, status: 'ACTIVE' },
      select: { id: true },
    })
    if (existing) continue
    await prisma.feeCharge.create({
      data: { assignmentId: assignment.id, termId: null, amount: fee.amount },
    })
    created += 1
  }
  return created
}

export async function generateChargesForFee(
  actor: AuthenticatedUser,
  feeId: string,
  ip?: string,
): Promise<ChargeGenerateResult> {
  const fee = await prisma.financeFee.findUnique({ where: { id: feeId }, select: { name: true } })
  if (!fee) {
    throw new AppError('Fee not found.', HttpStatus.NotFound)
  }
  const created = await generateChargesForFeeInner(feeId)
  await recordAudit({
    actorUserId: actor.id,
    action: 'finance.charge.generate',
    resourceType: 'feeCharge',
    resourceId: feeId,
    metadata: { feeId, feeName: fee.name, created },
    ip: ip ?? null,
  })
  return { created }
}

export async function generateChargesForSession(
  actor: AuthenticatedUser,
  sessionId: string,
  ip?: string,
): Promise<ChargeGenerateResult> {
  const session = await prisma.academicSession.findUnique({ where: { id: sessionId } })
  if (!session) {
    throw new AppError('Academic session not found.', HttpStatus.NotFound)
  }
  const fees = await prisma.financeFee.findMany({
    where: { sessionId, status: 'ACTIVE' },
    select: { id: true },
  })
  let created = 0
  for (const fee of fees) {
    created += await generateChargesForFeeInner(fee.id)
  }
  await recordAudit({
    actorUserId: actor.id,
    action: 'finance.charge.generate',
    resourceType: 'feeCharge',
    resourceId: sessionId,
    metadata: { sessionId, sessionName: session.name, created },
    ip: ip ?? null,
  })
  return { created }
}

// =============================================================================
// Payments
// =============================================================================

async function resolveExplicitAllocations(
  tx: Prisma.TransactionClient,
  pupilId: string,
  amountPaid: Prisma.Decimal,
  allocations: PaymentAllocationInput[],
): Promise<Array<{ chargeId: string; amount: Prisma.Decimal }>> {
  const chargeIds = [...new Set(allocations.map((allocation) => allocation.chargeId))]
  const charges = await tx.feeCharge.findMany({
    where: { id: { in: chargeIds }, assignment: { pupilId }, status: 'ACTIVE' },
    include: { allocations: { select: { amount: true } } },
  })
  if (charges.length !== chargeIds.length) {
    throw new AppError('One or more charge references are invalid for this pupil.', HttpStatus.BadRequest)
  }
  const chargeMap = new Map(charges.map((charge) => [charge.id, charge]))
  const rows: Array<{ chargeId: string; amount: Prisma.Decimal }> = []
  let total = new Prisma.Decimal(0)
  for (const allocation of allocations) {
    const charge = chargeMap.get(allocation.chargeId)
    if (!charge) {
      throw new AppError('One or more charge references are invalid for this pupil.', HttpStatus.BadRequest)
    }
    const amount = new Prisma.Decimal(allocation.amount)
    if (amount.lte(0)) {
      throw new AppError('Allocation amounts must be greater than zero.', HttpStatus.BadRequest)
    }
    const alreadyPaid = sumDecimal(charge.allocations.map((row) => row.amount))
    const remaining = charge.amount.minus(alreadyPaid)
    if (amount.gt(remaining)) {
      throw new AppError('An allocation exceeds the outstanding balance of its charge.', HttpStatus.BadRequest)
    }
    rows.push({ chargeId: allocation.chargeId, amount })
    total = total.plus(amount)
  }
  if (!total.equals(amountPaid)) {
    throw new AppError('Allocation amounts must total the payment amount.', HttpStatus.BadRequest)
  }
  return rows
}

async function resolveAutoAllocations(
  tx: Prisma.TransactionClient,
  pupilId: string,
  amountPaid: Prisma.Decimal,
): Promise<Array<{ chargeId: string; amount: Prisma.Decimal }>> {
  const charges = await tx.feeCharge.findMany({
    where: { assignment: { pupilId }, status: 'ACTIVE' },
    include: { allocations: { select: { amount: true } } },
    orderBy: { createdAt: 'asc' },
  })
  const rows: Array<{ chargeId: string; amount: Prisma.Decimal }> = []
  let remaining = amountPaid
  for (const charge of charges) {
    if (remaining.lte(0)) break
    const alreadyPaid = sumDecimal(charge.allocations.map((row) => row.amount))
    const outstanding = charge.amount.minus(alreadyPaid)
    if (outstanding.lte(0)) continue
    const apply = remaining.lt(outstanding) ? remaining : outstanding
    rows.push({ chargeId: charge.id, amount: apply })
    remaining = remaining.minus(apply)
  }
  if (remaining.gt(0)) {
    throw new AppError('The payment exceeds the pupil\'s outstanding balance.', HttpStatus.BadRequest)
  }
  return rows
}

export async function createPayment(
  actor: AuthenticatedUser,
  input: PaymentCreateInput,
  ip?: string,
): Promise<PaymentView> {
  const pupil = await prisma.pupil.findUnique({
    where: { id: input.pupilId },
    select: { id: true, pupilId: true },
  })
  if (!pupil) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }

  const amountPaid = new Prisma.Decimal(input.amountPaid)
  if (amountPaid.lte(0)) {
    throw new AppError('Payment amount must be greater than zero.', HttpStatus.BadRequest)
  }

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const count = await prisma.payment.count()
      const paymentReference = `PRPS-PAY-${String(count + attempt + 1).padStart(6, '0')}`
      const allocationRows = await prisma.$transaction(async (tx) => {
        const rows =
          input.allocations && input.allocations.length > 0
            ? await resolveExplicitAllocations(tx, input.pupilId, amountPaid, input.allocations)
            : await resolveAutoAllocations(tx, input.pupilId, amountPaid)
        if (rows.length === 0) {
          throw new AppError('The pupil has no outstanding charges to allocate the payment to.', HttpStatus.BadRequest)
        }
        return rows
      })

      const payment = await prisma.$transaction(async (tx) =>
        tx.payment.create({
          data: {
            paymentReference,
            pupilId: input.pupilId,
            amountPaid,
            paymentMethod: input.paymentMethod,
            paymentDate: input.paymentDate ? new Date(input.paymentDate) : new Date(),
            note: input.note?.trim() || null,
            receivedById: actor.id,
            allocations: { create: allocationRows },
          },
          include: paymentInclude,
        }),
      )

      await recordAudit({
        actorUserId: actor.id,
        action: 'finance.payment.create',
        resourceType: 'payment',
        resourceId: payment.id,
        metadata: {
          paymentReference,
          pupilId: pupil.pupilId,
          amountPaid: money(amountPaid),
          paymentMethod: input.paymentMethod,
          allocationCount: allocationRows.length,
        },
        ip: ip ?? null,
      })

      const userNames = await resolveUserNames([payment.receivedById])
      return toPaymentView(payment as never, userNames)
    } catch (error) {
      if (isUniqueViolation(error)) continue
      throw error
    }
  }
  throw new AppError('Could not generate a unique payment reference. Please try again.', HttpStatus.Conflict)
}

export async function voidPayment(
  actor: AuthenticatedUser,
  id: string,
  input: PaymentVoidInput,
  ip?: string,
): Promise<PaymentView> {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { pupil: { select: { pupilId: true } } },
  })
  if (!payment) {
    throw new AppError('Payment not found.', HttpStatus.NotFound)
  }
  if (payment.status === 'VOIDED') {
    throw new AppError('This payment has already been voided.', HttpStatus.BadRequest)
  }

  const reason = input.reason.trim()
  await prisma.$transaction(async (tx) => {
    await tx.paymentAllocation.deleteMany({ where: { paymentId: id } })
    await tx.payment.update({
      where: { id },
      data: { status: 'VOIDED', voidedAt: new Date(), voidedById: actor.id, voidReason: reason },
    })
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'finance.payment.void',
    resourceType: 'payment',
    resourceId: id,
    metadata: { paymentReference: payment.paymentReference, pupilId: payment.pupil.pupilId, reason },
    ip: ip ?? null,
  })

  return getPayment(id)
}

export async function getPayment(id: string): Promise<PaymentView> {
  const payment = await prisma.payment.findUnique({ where: { id }, include: paymentInclude })
  if (!payment) {
    throw new AppError('Payment not found.', HttpStatus.NotFound)
  }
  const userNames = await resolveUserNames([payment.receivedById, payment.voidedById])
  return toPaymentView(payment as never, userNames)
}

export async function listPayments(options: PaymentListOptions = {}): Promise<PaymentListResult> {
  const {
    q,
    pupilId,
    status,
    paymentMethod,
    from,
    to,
    page = 1,
    pageSize = 20,
  } = options
  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)))

  const where: Prisma.PaymentWhereInput = {}
  if (pupilId) where.pupilId = pupilId
  if (status) where.status = status
  if (paymentMethod) where.paymentMethod = paymentMethod
  if (from || to) {
    where.paymentDate = {}
    if (from) where.paymentDate.gte = new Date(from)
    if (to) where.paymentDate.lte = new Date(to)
  }
  if (q) {
    where.OR = [
      { paymentReference: { contains: q, mode: 'insensitive' } },
      { pupil: { pupilId: { contains: q, mode: 'insensitive' } } },
      { pupil: { firstName: { contains: q, mode: 'insensitive' } } },
      { pupil: { lastName: { contains: q, mode: 'insensitive' } } },
    ]
  }

  const [total, payments] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      include: paymentInclude,
      orderBy: { paymentDate: 'desc' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
  ])

  const userNames = await resolveUserNames(payments.flatMap((entry) => [entry.receivedById, entry.voidedById ?? null]))
  return {
    items: payments.map((entry) => toPaymentView(entry as never, userNames)),
    total,
    page: safePage,
    pageSize: safePageSize,
    hasMore: (safePage - 1) * safePageSize + payments.length < total,
  }
}

// =============================================================================
// Finance read models
// =============================================================================

export async function getPupilFinance(pupilId: string): Promise<PupilFinanceView> {
  const pupil = await prisma.pupil.findUnique({
    where: { id: pupilId },
    include: { class: { select: { name: true } } },
  })
  if (!pupil) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }

  const charges = await prisma.feeCharge.findMany({
    where: { assignment: { pupilId }, status: 'ACTIVE' },
    include: {
      assignment: { include: { fee: { select: { id: true, name: true } } } },
      term: { select: { id: true, name: true } },
      allocations: { select: { amount: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  const payments = await prisma.payment.findMany({
    where: { pupilId },
    include: paymentInclude,
    orderBy: { paymentDate: 'desc' },
  })
  const userNames = await resolveUserNames(payments.flatMap((entry) => [entry.receivedById, entry.voidedById ?? null]))

  const chargeViews: PupilChargeView[] = charges.map((charge) => {
    const paid = sumDecimal(charge.allocations.map((allocation) => allocation.amount))
    return {
      id: charge.id,
      feeId: charge.assignment.fee.id,
      feeName: charge.assignment.fee.name,
      termId: charge.term?.id ?? null,
      termName: charge.term?.name ?? null,
      amount: money(charge.amount),
      paid: money(paid),
      balance: money(charge.amount.minus(paid)),
    }
  })

  const totalDue = sumDecimal(charges.map((charge) => charge.amount))
  const totalPaid = sumDecimal(charges.flatMap((charge) => charge.allocations.map((allocation) => allocation.amount)))

  return {
    pupil: {
      id: pupil.id,
      pupilId: pupil.pupilId,
      fullName: `${pupil.firstName} ${pupil.lastName}`.trim(),
      className: pupil.class.name,
    },
    totalDue: money(totalDue),
    totalPaid: money(totalPaid),
    outstanding: money(totalDue.minus(totalPaid)),
    charges: chargeViews,
    payments: payments.map((entry) => toPaymentView(entry as never, userNames)),
  }
}

export async function listFinancePupils(options: {
  q?: string
  page?: number
  pageSize?: number
} = {}): Promise<FinancePupilListResult> {
  const { q, page = 1, pageSize = 20 } = options
  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)))

  const where: Prisma.PupilWhereInput = {}
  if (q) {
    where.OR = [
      { pupilId: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [total, pupils] = await Promise.all([
    prisma.pupil.count({ where }),
    prisma.pupil.findMany({
      where,
      include: { class: { select: { name: true } } },
      orderBy: { firstName: 'asc' },
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
  ])

  const pupilIds = pupils.map((entry) => entry.id)
  const balances = new Map<string, { due: Prisma.Decimal; paid: Prisma.Decimal; charges: number }>()
  for (const id of pupilIds) {
    balances.set(id, { due: new Prisma.Decimal(0), paid: new Prisma.Decimal(0), charges: 0 })
  }

  if (pupilIds.length > 0) {
    const charges = await prisma.feeCharge.findMany({
      where: { assignment: { pupilId: { in: pupilIds } }, status: 'ACTIVE' },
      select: {
        amount: true,
        assignment: { select: { pupilId: true } },
        allocations: { select: { amount: true } },
      },
    })
    for (const charge of charges) {
      const bucket = balances.get(charge.assignment.pupilId)
      if (!bucket) continue
      bucket.due = bucket.due.plus(charge.amount)
      bucket.charges += 1
      for (const allocation of charge.allocations) {
        bucket.paid = bucket.paid.plus(allocation.amount)
      }
    }
  }

  const items: PupilBalanceView[] = pupils.map((pupil) => {
    const bucket = balances.get(pupil.id) ?? { due: new Prisma.Decimal(0), paid: new Prisma.Decimal(0), charges: 0 }
    return {
      id: pupil.id,
      pupilId: pupil.pupilId,
      fullName: `${pupil.firstName} ${pupil.lastName}`.trim(),
      className: pupil.class.name,
      status: pupil.status,
      totalDue: money(bucket.due),
      totalPaid: money(bucket.paid),
      outstanding: money(bucket.due.minus(bucket.paid)),
      chargeCount: bucket.charges,
    }
  })
  items.sort((a, b) => Number(b.outstanding) - Number(a.outstanding))

  return {
    items,
    total,
    page: safePage,
    pageSize: safePageSize,
    hasMore: (safePage - 1) * safePageSize + pupils.length < total,
  }
}

export async function getFinanceSummary(): Promise<FinanceSummaryView> {
  const session = await prisma.academicSession.findFirst({
    where: { status: 'ACTIVE' },
    include: sessionCountsInclude,
    orderBy: { createdAt: 'desc' },
  })
  const term = session
    ? await prisma.academicTerm.findFirst({
        where: { sessionId: session.id, status: 'ACTIVE' },
        orderBy: { termNumber: 'desc' },
      })
    : null

  const [chargeAgg, paymentAgg, fees, pupilsWithOutstanding, recentPayments, termPayments] = await Promise.all([
    prisma.feeCharge.aggregate({ where: { status: 'ACTIVE' }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { status: 'ACTIVE' }, _sum: { amountPaid: true } }),
    prisma.financeFee.findMany({ select: { feeType: true, status: true } }),
    prisma.feeCharge.findMany({
      where: { status: 'ACTIVE' },
      select: {
        amount: true,
        assignment: { select: { pupilId: true } },
        allocations: { select: { amount: true } },
      },
    }),
    prisma.payment.findMany({
      where: { status: 'ACTIVE' },
      include: paymentInclude,
      orderBy: { paymentDate: 'desc' },
      take: 5,
    }),
    term
      ? prisma.payment.aggregate({
          where: { status: 'ACTIVE', paymentDate: { gte: term.startDate, lte: term.endDate } },
          _sum: { amountPaid: true },
          _count: true,
        })
      : Promise.resolve(null),
  ])

  const expected = chargeAgg._sum.amount ?? new Prisma.Decimal(0)
  const collected = paymentAgg._sum.amountPaid ?? new Prisma.Decimal(0)

  const byPupil = new Map<string, { due: Prisma.Decimal; paid: Prisma.Decimal }>()
  for (const charge of pupilsWithOutstanding) {
    const bucket = byPupil.get(charge.assignment.pupilId) ?? {
      due: new Prisma.Decimal(0),
      paid: new Prisma.Decimal(0),
    }
    bucket.due = bucket.due.plus(charge.amount)
    for (const allocation of charge.allocations) {
      bucket.paid = bucket.paid.plus(allocation.amount)
    }
    byPupil.set(charge.assignment.pupilId, bucket)
  }
  const pupilsOutstanding = [...byPupil.values()].filter((bucket) => bucket.due.minus(bucket.paid).gt(0)).length

  const byType: Record<FeeTypeValue, number> = { TERMLY: 0, DAILY: 0, OTHER: 0 }
  for (const fee of fees) byType[fee.feeType] += 1
  const activeFees = fees.filter((fee) => fee.status === 'ACTIVE').length

  const recentUserNames = await resolveUserNames(recentPayments.flatMap((entry) => [entry.receivedById, entry.voidedById ?? null]))

  return {
    session: session ? toSessionView(session) : null,
    term: term ? toTermView(term) : null,
    expectedFees: money(expected),
    collected: money(collected),
    outstanding: money(expected.minus(collected)),
    pupilsWithOutstanding: pupilsOutstanding,
    paymentsThisTerm: money(termPayments?._sum.amountPaid ?? new Prisma.Decimal(0)),
    paymentsThisTermCount: termPayments?._count ?? 0,
    feeSummary: { total: fees.length, active: activeFees, byType },
    recentPayments: recentPayments.map((entry) => toPaymentView(entry as never, recentUserNames)),
  }
}