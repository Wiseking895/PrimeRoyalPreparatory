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
  type CombinedReconciliationClassSummary,
  type CombinedReconciliationPupilRow,
  type CombinedReconciliationView,
  type DailyFinanceStatus,
  type DailyPupilFinanceListResult,
  type DailyPupilFinanceRow,
  type DailyReconciliationCloseView,
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
  type ReconciliationClassSummary,
  type ReconciliationPupilRow,
  type ReconciliationStatus,
  type ReconciliationView,
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
  termId: string
  name: string
  feeType: FeeTypeValue
  amount: string
  description?: string
  status?: SessionStatusValue
}

export interface FeeUpdateInput {
  termId?: string
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

export interface MarkPaidInput {
  pupilId: string
  paymentMethod?: PaymentMethodValue
  paymentDate?: string
  dailyPaid: boolean
  paPaid: boolean
  note?: string
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

function countWeekdays(start: Date, end: Date): number {
  const s = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const e = new Date(end.getFullYear(), end.getMonth(), end.getDate())
  let count = 0
  const cursor = new Date(s)
  while (cursor.getTime() <= e.getTime()) {
    const dow = cursor.getDay()
    if (dow !== 0 && dow !== 6) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
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

  const schoolDays = input.schoolDays ?? countWeekdays(startDate, endDate)

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
          schoolDays,
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
  term: { select: { id: true, name: true } },
  assignments: { where: { status: 'ACTIVE' }, select: { id: true } },
  _count: { select: { assignments: true } },
} as const

function toFeeViewRecord(fee: Prisma.FinanceFeeGetPayload<{ include: typeof feeInclude }>): FeeRecord {
  return {
    id: fee.id,
    sessionId: fee.sessionId,
    sessionName: fee.session.name,
    termId: fee.termId,
    termName: fee.term.name,
    name: fee.name,
    feeType: fee.feeType,
    amount: fee.amount,
    description: fee.description,
    status: fee.status,
    createdAt: fee.createdAt,
    updatedAt: fee.updatedAt,
    assignmentCount: fee._count.assignments,
    activeAssignmentCount: fee.assignments.length,
    chargeCount: 0,
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

async function assignFeeToActivePupils(feeId: string): Promise<void> {
  const fee = await prisma.financeFee.findUnique({ where: { id: feeId }, select: { sessionId: true } })
  if (!fee) return

  const activePupils = await prisma.pupil.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  })
  if (activePupils.length === 0) return

  await prisma.feeAssignment.createMany({
    data: activePupils.map((pupil) => ({ pupilId: pupil.id, feeId, status: 'ACTIVE' })),
    skipDuplicates: true,
  })
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

  const term = await prisma.academicTerm.findUnique({ where: { id: input.termId } })
  if (!term) {
    throw new AppError('Academic term not found.', HttpStatus.NotFound)
  }
  if (term.sessionId !== input.sessionId) {
    throw new AppError('The selected term does not belong to the selected session.', HttpStatus.BadRequest)
  }

  const fee = await prisma.financeFee.create({
    data: {
      sessionId: input.sessionId,
      termId: input.termId,
      name: input.name.trim(),
      feeType: input.feeType,
      amount: new Prisma.Decimal(input.amount),
      description: input.description?.trim() || null,
      status: input.status ?? 'ACTIVE',
    },
  }).catch((error: unknown) => {
    if (isUniqueViolation(error)) {
      throw new AppError('A fee with this name already exists in the session and term.', HttpStatus.Conflict)
    }
    throw error
  })

  await assignFeeToActivePupils(fee.id)
  await ensureChargesForFee(fee.id)

  await recordAudit({
    actorUserId: actor.id,
    action: 'finance.fee.create',
    resourceType: 'financeFee',
    resourceId: fee.id,
    metadata: { sessionId: input.sessionId, termId: input.termId, name: fee.name, feeType: fee.feeType, amount: money(fee.amount) },
    ip: ip ?? null,
  })

  return getFee(fee.id)
}

export interface FeeBatchCreateInput {
  sessionId: string
  termId: string
  fees: Array<{
    name: string
    feeType: FeeTypeValue
    amount: string
    description?: string
  }>
}

export async function createFeesBatch(
  actor: AuthenticatedUser,
  input: FeeBatchCreateInput,
  ip?: string,
): Promise<FeeView[]> {
  const session = await prisma.academicSession.findUnique({ where: { id: input.sessionId } })
  if (!session) {
    throw new AppError('Academic session not found.', HttpStatus.NotFound)
  }

  const term = await prisma.academicTerm.findUnique({ where: { id: input.termId } })
  if (!term) {
    throw new AppError('Academic term not found.', HttpStatus.NotFound)
  }
  if (term.sessionId !== input.sessionId) {
    throw new AppError('The selected term does not belong to the selected session.', HttpStatus.BadRequest)
  }

  const createdIds: string[] = []

  await prisma.$transaction(async (tx) => {
    for (const item of input.fees) {
      const fee = await tx.financeFee.create({
        data: {
          sessionId: input.sessionId,
          termId: input.termId,
          name: item.name.trim(),
          feeType: item.feeType,
          amount: new Prisma.Decimal(item.amount),
          description: item.description?.trim() || null,
          status: 'ACTIVE',
        },
      }).catch((error: unknown) => {
        if (isUniqueViolation(error)) {
          throw new AppError(`A fee with the name "${item.name.trim()}" already exists in this session and term.`, HttpStatus.Conflict)
        }
        throw error
      })
      createdIds.push(fee.id)
    }
  })

  for (const feeId of createdIds) {
    await assignFeeToActivePupils(feeId)
    await ensureChargesForFee(feeId)
    await recordAudit({
      actorUserId: actor.id,
      action: 'finance.fee.create',
      resourceType: 'financeFee',
      resourceId: feeId,
      metadata: { sessionId: input.sessionId, termId: input.termId, batch: true },
      ip: ip ?? null,
    })
  }

  const results = await Promise.all(createdIds.map((id) => getFee(id)))
  return results
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

  if (input.termId !== undefined) {
    const term = await prisma.academicTerm.findUnique({ where: { id: input.termId } })
    if (!term) {
      throw new AppError('Academic term not found.', HttpStatus.NotFound)
    }
    if (term.sessionId !== existing.sessionId) {
      throw new AppError('The selected term does not belong to the fee\'s session.', HttpStatus.BadRequest)
    }
    data.term = { connect: { id: input.termId } }
    changed.push('termId')
  }
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
        throw new AppError('A fee with this name already exists in the session and term.', HttpStatus.Conflict)
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

export async function exemptPupilFromFee(
  actor: AuthenticatedUser,
  feeId: string,
  assignmentId: string,
  ip?: string,
): Promise<FeeAssignmentView> {
  const assignment = await prisma.feeAssignment.findUnique({
    where: { id: assignmentId, feeId },
    include: { fee: { select: { name: true } }, pupil: { select: { pupilId: true } } },
  })
  if (!assignment) {
    throw new AppError('Fee assignment not found.', HttpStatus.NotFound)
  }

  if (assignment.status !== 'EXEMPT') {
    await prisma.feeAssignment.update({ where: { id: assignmentId }, data: { status: 'EXEMPT' } })
    await recordAudit({
      actorUserId: actor.id,
      action: 'finance.fee.assign_exempt',
      resourceType: 'feeAssignment',
      resourceId: assignmentId,
      metadata: { feeName: assignment.fee.name, pupilId: assignment.pupil.pupilId },
      ip: ip ?? null,
    })
  }

  return getFeeAssignment(assignmentId)
}

export async function removeExemption(
  actor: AuthenticatedUser,
  feeId: string,
  assignmentId: string,
  ip?: string,
): Promise<FeeAssignmentView> {
  const assignment = await prisma.feeAssignment.findUnique({
    where: { id: assignmentId, feeId },
    include: { fee: { select: { name: true } }, pupil: { select: { pupilId: true } } },
  })
  if (!assignment) {
    throw new AppError('Fee assignment not found.', HttpStatus.NotFound)
  }

  if (assignment.status === 'EXEMPT') {
    await prisma.feeAssignment.update({ where: { id: assignmentId }, data: { status: 'ACTIVE' } })
    await recordAudit({
      actorUserId: actor.id,
      action: 'finance.fee.assign_remove_exemption',
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
    include: { session: { select: { name: true } }, term: { select: { id: true, name: true, schoolDays: true } } },
  })
  if (!fee) {
    throw new AppError('Fee not found.', HttpStatus.NotFound)
  }

  const assignments = await prisma.feeAssignment.findMany({
    where: { feeId, status: 'ACTIVE' },
    select: { id: true },
  })
  if (assignments.length === 0) return 0

  if (fee.feeType === 'DAILY' || fee.feeType === 'PA') {
    if (fee.term.schoolDays <= 0) {
      throw new AppError(
        `Term "${fee.term.name}" has no school days. Set the school day count before generating daily charges.`,
        HttpStatus.BadRequest,
      )
    }
    const rows: Array<{ assignmentId: string; termId: string; amount: Prisma.Decimal }> = []
    for (const assignment of assignments) {
      rows.push({
        assignmentId: assignment.id,
        termId: fee.termId,
        amount: fee.amount.mul(fee.term.schoolDays),
      })
    }
    if (rows.length === 0) return 0
    const result = await prisma.feeCharge.createMany({ data: rows, skipDuplicates: true })
    return result.count
  }

  if (fee.feeType === 'TERMLY') {
    const rows: Array<{ assignmentId: string; termId: string; amount: Prisma.Decimal }> = []
    for (const assignment of assignments) {
      rows.push({ assignmentId: assignment.id, termId: fee.termId, amount: fee.amount })
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

/**
 * Ensure charges exist for a specific fee. Called automatically when a fee is
 * created, when a pupil is registered, or for manual reconciliation. Idempotent
 * — running multiple times never duplicates charges.
 */
export async function ensureChargesForFee(feeId: string): Promise<number> {
  return generateChargesForFeeInner(feeId)
}

/**
 * Ensure charges exist for all active fees in the active session. Used for
 * manual reconciliation and automatic sync. Idempotent.
 */
export async function ensureChargesForActiveSession(): Promise<{ feesProcessed: number; chargesCreated: number }> {
  const activeSession = await prisma.academicSession.findFirst({ where: { status: 'ACTIVE' } })
  if (!activeSession) return { feesProcessed: 0, chargesCreated: 0 }

  const fees = await prisma.financeFee.findMany({
    where: { sessionId: activeSession.id, status: 'ACTIVE' },
    select: { id: true },
  })

  let chargesCreated = 0
  for (const fee of fees) {
    chargesCreated += await generateChargesForFeeInner(fee.id)
  }

  return { feesProcessed: fees.length, chargesCreated }
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

/**
 * Record a payment for DAILY and/or PA fees using Paid/Not Paid status.
 * The backend retrieves authoritative fee amounts from the database.
 * The frontend cannot manipulate amounts.
 */
export async function markPaid(
  actor: AuthenticatedUser,
  input: MarkPaidInput,
  ip?: string,
): Promise<PaymentView> {
  if (!input.dailyPaid && !input.paPaid) {
    throw new AppError('Select at least one fee to mark as paid.', HttpStatus.BadRequest)
  }

  const pupil = await prisma.pupil.findUnique({
    where: { id: input.pupilId },
    select: { id: true, pupilId: true, status: true },
  })
  if (!pupil) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }
  if (pupil.status !== 'ACTIVE') {
    throw new AppError('Cannot record payment for an inactive pupil.', HttpStatus.BadRequest)
  }

  const activeSession = await prisma.academicSession.findFirst({ where: { status: 'ACTIVE' } })
  if (!activeSession) {
    throw new AppError('No active academic session found.', HttpStatus.BadRequest)
  }

  const activeTerm = await prisma.academicTerm.findFirst({
    where: { sessionId: activeSession.id, status: 'ACTIVE' },
  })
  if (!activeTerm) {
    throw new AppError('No active academic term found.', HttpStatus.BadRequest)
  }

  const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date()
  const dayOfWeek = paymentDate.getUTCDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new AppError('Cannot record a school fee payment for a weekend date.', HttpStatus.BadRequest)
  }

  // Check if this day's reconciliation is locked
  const paymentDateOnly = new Date(paymentDate.toISOString().slice(0, 10) + 'T00:00:00.000Z')
  await assertReconciliationNotLocked(paymentDateOnly)

  const fees = await prisma.financeFee.findMany({
    where: { sessionId: activeSession.id, termId: activeTerm.id, status: 'ACTIVE' },
    select: { id: true, name: true, feeType: true, amount: true },
  })

  const dailyFee = fees.find((f) => f.feeType === 'DAILY')
  const paFee = fees.find((f) => f.feeType === 'PA')

  if (input.dailyPaid && !dailyFee) {
    throw new AppError('No active Daily Fee structure found for the current term.', HttpStatus.BadRequest)
  }
  if (input.paPaid && !paFee) {
    throw new AppError('No active PA Fee structure found for the current term.', HttpStatus.BadRequest)
  }

  const allocations: Array<{ chargeId: string; amount: Prisma.Decimal; feeName: string }> = []
  let totalAmount = new Prisma.Decimal(0)

  const feeChecks = [
    { paid: input.dailyPaid, fee: dailyFee, label: 'Daily Fee' },
    { paid: input.paPaid, fee: paFee, label: 'PA Fee' },
  ]

  for (const check of feeChecks) {
    if (!check.paid || !check.fee) continue

    const assignment = await prisma.feeAssignment.findFirst({
      where: { pupilId: input.pupilId, feeId: check.fee.id, status: 'ACTIVE' },
      select: { id: true },
    })
    if (!assignment) {
      throw new AppError(`${check.label} is not applicable to this pupil.`, HttpStatus.BadRequest)
    }

    const charge = await prisma.feeCharge.findFirst({
      where: { assignmentId: assignment.id, termId: activeTerm.id, status: 'ACTIVE' },
      include: { allocations: { select: { amount: true } } },
    })
    if (!charge) {
      throw new AppError(`No ${check.label} charge found for this pupil.`, HttpStatus.BadRequest)
    }

    const alreadyPaid = sumDecimal(charge.allocations.map((a) => a.amount))
    const outstanding = charge.amount.minus(alreadyPaid)
    if (outstanding.lte(0)) {
      throw new AppError(`${check.label} is already fully paid for this pupil.`, HttpStatus.BadRequest)
    }

    const alreadyPaidToday = await prisma.paymentAllocation.findFirst({
      where: {
        chargeId: charge.id,
        payment: { pupilId: input.pupilId, status: 'ACTIVE', paymentDate: paymentDate },
      },
      select: { id: true },
    })
    if (alreadyPaidToday) {
      throw new AppError(`${check.label} was already recorded for this pupil on this date.`, HttpStatus.BadRequest)
    }

    const payAmount = check.fee.amount.lt(outstanding) ? check.fee.amount : outstanding
    allocations.push({ chargeId: charge.id, amount: payAmount, feeName: check.fee.name })
    totalAmount = totalAmount.plus(payAmount)
  }

  if (allocations.length === 0) {
    throw new AppError('No applicable fees to record.', HttpStatus.BadRequest)
  }

  const paymentMethod = input.paymentMethod || 'CASH'

  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const count = await prisma.payment.count()
      const paymentReference = `PRPS-PAY-${String(count + attempt + 1).padStart(6, '0')}`

      const allocationData = allocations.map((a) => ({
        chargeId: a.chargeId,
        amount: a.amount,
      }))

      const payment = await prisma.$transaction(async (tx) =>
        tx.payment.create({
          data: {
            paymentReference,
            pupilId: input.pupilId,
            amountPaid: totalAmount,
            paymentMethod,
            paymentDate,
            note: input.note?.trim() || null,
            receivedById: actor.id,
            allocations: { create: allocationData },
          },
          include: paymentInclude,
        }),
      )

      const feeNames = allocations.map((a) => a.feeName).join(', ')
      await recordAudit({
        actorUserId: actor.id,
        action: 'finance.payment.create',
        resourceType: 'payment',
        resourceId: payment.id,
        metadata: {
          paymentReference,
          pupilId: pupil.pupilId,
          amountPaid: money(totalAmount),
          paymentMethod,
          allocationCount: allocationData.length,
          feeNames,
          dailyPaid: input.dailyPaid,
          paPaid: input.paPaid,
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

  // Check if this day's reconciliation is locked
  const paymentDateOnly = new Date(payment.paymentDate.toISOString().slice(0, 10) + 'T00:00:00.000Z')
  await assertReconciliationNotLocked(paymentDateOnly)

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

  // Session-scoped charge aggregation: charges belong to fees which belong to sessions,
  // and the charge's termId scopes it to a specific term.
  const chargeWhere: Prisma.FeeChargeWhereInput = { status: 'ACTIVE' }
  if (session) {
    chargeWhere.assignment = { fee: { sessionId: session.id } }
  }
  if (term) {
    chargeWhere.termId = term.id
  }

  const [chargeAgg, fees, sessionCharges, recentPayments, termPayments] = await Promise.all([
    prisma.feeCharge.aggregate({ where: chargeWhere, _sum: { amount: true } }),
    prisma.financeFee.findMany({
      where: session ? { sessionId: session.id } : undefined,
      select: { feeType: true, status: true },
    }),
    prisma.feeCharge.findMany({
      where: chargeWhere,
      select: {
        amount: true,
        assignment: { select: { pupilId: true } },
        allocations: {
          where: { payment: { status: 'ACTIVE' } },
          select: { amount: true },
        },
      },
    }),
    prisma.payment.findMany({
      where: {
        status: 'ACTIVE',
        ...(term
          ? { paymentDate: { gte: term.startDate, lte: term.endDate } }
          : {}),
      },
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

  // Collected = sum of active payment allocations against session+term charges
  let collected = new Prisma.Decimal(0)
  for (const charge of sessionCharges) {
    for (const allocation of charge.allocations) {
      collected = collected.plus(allocation.amount)
    }
  }

  const byPupil = new Map<string, { due: Prisma.Decimal; paid: Prisma.Decimal }>()
  for (const charge of sessionCharges) {
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

  const byType: Record<FeeTypeValue, number> = { TERMLY: 0, DAILY: 0, OTHER: 0, PA: 0 }
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

export interface AdmissionFeeView {
  id: string
  name: string
  amount: string
  description: string | null
}

/**
 * Retrieve the current admission fee for the registration flow.
 * Searches for the most recently created ACTIVE fee with "admission"
 * in its name (case-insensitive). Returns null if none exists.
 */
export async function getAdmissionFee(): Promise<AdmissionFeeView | null> {
  const fee = await prisma.financeFee.findFirst({
    where: {
      status: 'ACTIVE',
      name: { contains: 'admission', mode: 'insensitive' },
    },
    orderBy: { createdAt: 'desc' },
  })
  if (!fee) return null
  return {
    id: fee.id,
    name: fee.name,
    amount: money(fee.amount),
    description: fee.description,
  }
}

// ---------------------------------------------------------------------------
// Daily Pupil Finance — per-pupil collection state for a given school day.
// Combines DAILY and PA fee payment status into a single view.
// ---------------------------------------------------------------------------

export interface DailyPupilFinanceOptions {
  date: string
  classId?: string
  q?: string
}

export async function getDailyPupilFinance(
  options: DailyPupilFinanceOptions,
): Promise<DailyPupilFinanceListResult> {
  const { date, classId, q } = options

  const dateObj = new Date(date + 'T00:00:00.000Z')
  const dayOfWeek = dateObj.getUTCDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new AppError('Cannot view daily finance for a weekend date. Select a school day.', HttpStatus.BadRequest)
  }

  const session = await prisma.academicSession.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!session) {
    throw new AppError('No active academic session found.', HttpStatus.BadRequest)
  }

  const term = await prisma.academicTerm.findFirst({
    where: { sessionId: session.id, status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { termNumber: 'desc' },
  })
  if (!term) {
    throw new AppError('No active academic term found.', HttpStatus.BadRequest)
  }

  // Find DAILY and PA fee structures for this session+term
  const [dailyFee, paFee] = await Promise.all([
    prisma.financeFee.findFirst({
      where: { sessionId: session.id, termId: term.id, feeType: 'DAILY', status: 'ACTIVE' },
      select: { id: true, amount: true },
    }),
    prisma.financeFee.findFirst({
      where: { sessionId: session.id, termId: term.id, feeType: 'PA', status: 'ACTIVE' },
      select: { id: true, amount: true },
    }),
  ])

  if (!dailyFee) {
    throw new AppError('No active Daily Fee structure found for the current term.', HttpStatus.BadRequest)
  }
  if (!paFee) {
    throw new AppError('No active PA Fee structure found for the current term.', HttpStatus.BadRequest)
  }

  // Fetch active pupils (optionally filtered by class)
  const pupilWhere: Prisma.PupilWhereInput = { status: 'ACTIVE' }
  if (classId) {
    pupilWhere.classId = classId
  }
  if (q) {
    pupilWhere.OR = [
      { pupilId: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
    ]
  }

  const pupils = await prisma.pupil.findMany({
    where: pupilWhere,
    include: { class: { select: { id: true, name: true } } },
    orderBy: { firstName: 'asc' },
  })

  const pupilIds = pupils.map((p) => p.id)

  // Attendance for the date
  const attendanceRecords = pupilIds.length > 0
    ? await prisma.attendance.findMany({
        where: {
          date: dateObj,
          pupilId: { in: pupilIds },
          sessionId: session.id,
        },
        select: { pupilId: true, status: true },
      })
    : []
  const attendanceMap = new Map<string, string>()
  for (const r of attendanceRecords) {
    if (r.pupilId) attendanceMap.set(r.pupilId, r.status)
  }

  // Fee assignments for DAILY and PA
  const [dailyAssignments, paAssignments] = await Promise.all([
    dailyFee
      ? prisma.feeAssignment.findMany({
          where: { feeId: dailyFee.id, pupilId: { in: pupilIds }, status: { in: ['ACTIVE', 'EXEMPT'] } },
          select: { pupilId: true, status: true },
        })
      : [],
    paFee
      ? prisma.feeAssignment.findMany({
          where: { feeId: paFee.id, pupilId: { in: pupilIds }, status: { in: ['ACTIVE', 'EXEMPT'] } },
          select: { pupilId: true, status: true },
        })
      : [],
  ])

  const dailyAssignmentMap = new Map<string, 'ACTIVE' | 'EXEMPT'>()
  for (const a of dailyAssignments) dailyAssignmentMap.set(a.pupilId, a.status as 'ACTIVE' | 'EXEMPT')

  const paAssignmentMap = new Map<string, 'ACTIVE' | 'EXEMPT'>()
  for (const a of paAssignments) paAssignmentMap.set(a.pupilId, a.status as 'ACTIVE' | 'EXEMPT')

  // Payments for this date — look at allocations for charges belonging to DAILY and PA fees
  const [dailyDayPayments, paDayPayments] = await Promise.all([
    dailyFee
      ? prisma.paymentAllocation.findMany({
          where: {
            payment: { status: 'ACTIVE', paymentDate: dateObj },
            charge: {
              assignment: {
                feeId: dailyFee.id,
                pupilId: { in: pupilIds },
              },
            },
          },
          select: {
            amount: true,
            charge: { select: { assignment: { select: { pupilId: true } } } },
          },
        })
      : [],
    paFee
      ? prisma.paymentAllocation.findMany({
          where: {
            payment: { status: 'ACTIVE', paymentDate: dateObj },
            charge: {
              assignment: {
                feeId: paFee.id,
                pupilId: { in: pupilIds },
              },
            },
          },
          select: {
            amount: true,
            charge: { select: { assignment: { select: { pupilId: true } } } },
          },
        })
      : [],
  ])

  const dailyPaidByPupil = new Map<string, Prisma.Decimal>()
  for (const alloc of dailyDayPayments) {
    const pid = alloc.charge.assignment.pupilId
    dailyPaidByPupil.set(pid, (dailyPaidByPupil.get(pid) ?? new Prisma.Decimal(0)).plus(alloc.amount))
  }

  const paPaidByPupil = new Map<string, Prisma.Decimal>()
  for (const alloc of paDayPayments) {
    const pid = alloc.charge.assignment.pupilId
    paPaidByPupil.set(pid, (paPaidByPupil.get(pid) ?? new Prisma.Decimal(0)).plus(alloc.amount))
  }

  // Build per-pupil rows
  const dailyFeeAmt = dailyFee?.amount ?? new Prisma.Decimal(0)
  const paFeeAmt = paFee?.amount ?? new Prisma.Decimal(0)

  const items: DailyPupilFinanceRow[] = pupils.map((pupil) => {
    const attendanceStatus = attendanceMap.get(pupil.id) ?? null
    const isAbsent = !attendanceStatus || attendanceStatus !== 'PRESENT'

    const dailyAssignmentStatus = dailyAssignmentMap.get(pupil.id) ?? null
    const paAssignmentStatus = paAssignmentMap.get(pupil.id) ?? null

    const dailyExempt = dailyAssignmentStatus === 'EXEMPT'
    const paExempt = paAssignmentStatus === 'EXEMPT'

    const dailyPaid = isAbsent
      ? new Prisma.Decimal(0)
      : dailyExempt
        ? new Prisma.Decimal(0)
        : (dailyPaidByPupil.get(pupil.id) ?? new Prisma.Decimal(0))

    const paPaid = isAbsent
      ? new Prisma.Decimal(0)
      : paExempt
        ? new Prisma.Decimal(0)
        : (paPaidByPupil.get(pupil.id) ?? new Prisma.Decimal(0))

    // Outstanding = (dailyFee - dailyPaid) + (paFee - paPaid), but only for non-absent, non-exempt
    const dailyOutstanding = isAbsent || dailyExempt || dailyPaid.gte(dailyFeeAmt)
      ? new Prisma.Decimal(0)
      : dailyFeeAmt.minus(dailyPaid)

    const paOutstanding = isAbsent || paExempt || paPaid.gte(paFeeAmt)
      ? new Prisma.Decimal(0)
      : paFeeAmt.minus(paPaid)

    const outstanding = dailyOutstanding.plus(paOutstanding)

    // Determine finance status
    let financeStatus: DailyFinanceStatus
    if (isAbsent) {
      financeStatus = 'ABSENT'
    } else if (dailyExempt && paExempt) {
      financeStatus = 'EXEMPT'
    } else if (dailyExempt || paExempt) {
      // One exempt - status should reflect exemption
      financeStatus = 'EXEMPT'
    } else if (dailyPaid.gte(dailyFeeAmt) && paPaid.gte(paFeeAmt)) {
      financeStatus = 'PAID'
    } else if (dailyPaid.gte(dailyFeeAmt) || paPaid.gte(paFeeAmt)) {
      financeStatus = outstanding.gt(0) ? 'PARTIALLY_PAID' : 'PAID'
    } else if (outstanding.gt(0)) {
      financeStatus = 'NOT_PAID'
    } else {
      financeStatus = 'PAID'
    }

    return {
      id: pupil.id,
      pupilId: pupil.pupilId,
      fullName: `${pupil.firstName} ${pupil.lastName}`.trim(),
      className: pupil.class.name,
      classId: pupil.classId,
      status: pupil.status,
      dailyPaid: money(dailyPaid),
      paPaid: money(paPaid),
      outstanding: money(outstanding),
      financeStatus,
      attendanceStatus,
      dailyAssignmentStatus,
      paAssignmentStatus,
    }
  })

  return {
    items,
    date,
    sessionName: session.name,
    termName: term.name,
    dailyFeeAmount: money(dailyFeeAmt),
    paFeeAmount: money(paFeeAmt),
  }
}

// ---------------------------------------------------------------------------
// Reconciliation — per-pupil payment status for a given date and fee type.
// Returns class-by-class breakdown of PAID / NOT_PAID / ABSENT / EXEMPT.
// ---------------------------------------------------------------------------

export interface ReconciliationOptions {
  date: string
  feeType: 'DAILY' | 'PA'
}

export async function getReconciliation(options: ReconciliationOptions): Promise<ReconciliationView> {
  const { date, feeType } = options

  const dateObj = new Date(date + 'T00:00:00.000Z')
  const dayOfWeek = dateObj.getUTCDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new AppError('Cannot reconcile for a weekend date. Select a school day.', HttpStatus.BadRequest)
  }

  const session = await prisma.academicSession.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!session) {
    throw new AppError('No active academic session found.', HttpStatus.BadRequest)
  }

  const term = await prisma.academicTerm.findFirst({
    where: { sessionId: session.id, status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { termNumber: 'desc' },
  })
  if (!term) {
    throw new AppError('No active academic term found.', HttpStatus.BadRequest)
  }

  const fee = await prisma.financeFee.findFirst({
    where: { sessionId: session.id, termId: term.id, feeType, status: 'ACTIVE' },
    select: { id: true, amount: true, name: true },
  })
  if (!fee) {
    throw new AppError(`No active ${feeType === 'DAILY' ? 'Daily Fee' : 'PA Fee'} structure found for the current term.`, HttpStatus.BadRequest)
  }

  const classes = await prisma.schoolClass.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { sortOrder: 'asc' },
  })
  const classIds = classes.map((c) => c.id)

  // All active pupils by class
  const allPupils = await prisma.pupil.findMany({
    where: { classId: { in: classIds }, status: 'ACTIVE' },
    select: { id: true, pupilId: true, firstName: true, lastName: true, classId: true },
    orderBy: { firstName: 'asc' },
  })
  const pupilByClass = new Map<string, typeof allPupils>()
  for (const cls of classes) pupilByClass.set(cls.id, [])
  for (const p of allPupils) {
    const arr = pupilByClass.get(p.classId)
    if (arr) arr.push(p)
  }

  // Attendance for the date — pupils with PRESENT status
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      date: dateObj,
      pupilId: { not: null },
      sessionId: session.id,
      classId: { in: classIds },
    },
    select: { pupilId: true, status: true },
  })
  const attendanceMap = new Map<string, string>()
  for (const r of attendanceRecords) {
    if (r.pupilId) attendanceMap.set(r.pupilId, r.status)
  }

  // Fee assignments for this fee type
  const assignments = await prisma.feeAssignment.findMany({
    where: { feeId: fee.id, status: { in: ['ACTIVE', 'EXEMPT'] } },
    select: { pupilId: true, status: true },
  })
  const assignmentMap = new Map<string, 'ACTIVE' | 'EXEMPT'>()
  for (const a of assignments) {
    assignmentMap.set(a.pupilId, a.status as 'ACTIVE' | 'EXEMPT')
  }

  // Payments for this date — look at allocations for charges belonging to this fee
  const dayPayments = await prisma.paymentAllocation.findMany({
    where: {
      payment: {
        status: 'ACTIVE',
        paymentDate: dateObj,
      },
      charge: {
        assignment: {
          feeId: fee.id,
          pupil: { classId: { in: classIds }, status: 'ACTIVE' },
        },
      },
    },
    select: {
      amount: true,
      charge: {
        select: {
          assignment: {
            select: { pupilId: true },
          },
        },
      },
    },
  })
  const paidAmountByPupil = new Map<string, Prisma.Decimal>()
  for (const alloc of dayPayments) {
    const pupilId = alloc.charge.assignment.pupilId
    const current = paidAmountByPupil.get(pupilId) ?? new Prisma.Decimal(0)
    paidAmountByPupil.set(pupilId, current.plus(alloc.amount))
  }

  // Build reconciliation per class
  const classSummaries: ReconciliationClassSummary[] = []
  let totalPupils = 0
  let totalPaid = 0
  let totalNotPaid = 0
  let totalAbsent = 0
  let totalExempt = 0
  let totalExpected = new Prisma.Decimal(0)
  let totalCollected = new Prisma.Decimal(0)

  for (const cls of classes) {
    const pupils = pupilByClass.get(cls.id) ?? []
    const pupilRows: ReconciliationPupilRow[] = []
    let clsPaid = 0
    let clsNotPaid = 0
    let clsAbsent = 0
    let clsExempt = 0
    let clsExpected = new Prisma.Decimal(0)
    let clsCollected = new Prisma.Decimal(0)

    for (const pupil of pupils) {
      const attendanceStatus = attendanceMap.get(pupil.id)
      const assignmentStatus = assignmentMap.get(pupil.id) ?? null
      const paidAmount = paidAmountByPupil.get(pupil.id)
      const paid = paidAmount ? paidAmount.toFixed(2) : '0.00'
      const feeAmt = money(fee.amount)
      const isAbsent = !attendanceStatus || attendanceStatus !== 'PRESENT'

      let status: ReconciliationStatus

      if (assignmentStatus === 'EXEMPT') {
        // Exempt from this fee
        status = 'EXEMPT'
        clsExempt += 1
      } else if (assignmentStatus === 'ACTIVE' && paidAmountByPupil.has(pupil.id)) {
        // Has assignment and payment exists for this date
        status = 'PAID'
        clsPaid += 1
        clsCollected = clsCollected.plus(paidAmount ?? 0)
      } else if (assignmentStatus === 'ACTIVE') {
        // Has assignment but no payment
        status = 'NOT_PAID'
        clsNotPaid += 1
        clsExpected = clsExpected.plus(fee.amount)
      } else {
        // No assignment at all — treat as NOT PAID (shouldn't normally happen)
        status = 'NOT_PAID'
        clsNotPaid += 1
        clsExpected = clsExpected.plus(fee.amount)
      }

      if (isAbsent) {
        clsAbsent += 1
      }

      pupilRows.push({
        pupilId: pupil.id,
        pupilCode: pupil.pupilId,
        fullName: `${pupil.firstName} ${pupil.lastName}`,
        className: cls.name,
        status,
        feeAmount: feeAmt,
        paidAmount: paid,
        assignmentStatus,
      })
    }

    classSummaries.push({
      classId: cls.id,
      className: cls.name,
      totalPupils: pupils.length,
      paidCount: clsPaid,
      notPaidCount: clsNotPaid,
      absentCount: clsAbsent,
      exemptCount: clsExempt,
      expectedRevenue: money(clsExpected),
      collectedRevenue: money(clsCollected),
      pupils: pupilRows,
    })

    totalPupils += pupils.length
    totalPaid += clsPaid
    totalNotPaid += clsNotPaid
    totalAbsent += clsAbsent
    totalExempt += clsExempt
    totalExpected = totalExpected.plus(clsExpected)
    totalCollected = totalCollected.plus(clsCollected)
  }

  return {
    date,
    feeType,
    sessionName: session.name,
    termName: term.name,
    feeAmount: money(fee.amount),
    classes: classSummaries,
    totals: {
      totalPupils,
      paidCount: totalPaid,
      notPaidCount: totalNotPaid,
      absentCount: totalAbsent,
      exemptCount: totalExempt,
      expectedRevenue: money(totalExpected),
      collectedRevenue: money(totalCollected),
    },
  }
}

// ---------------------------------------------------------------------------
// Combined Daily Reconciliation — per-pupil payment status for DAILY and PA fees together.
// ---------------------------------------------------------------------------

export interface CombinedReconciliationOptions {
  date: string
  classId?: string
  q?: string
}

export async function getCombinedReconciliation(options: CombinedReconciliationOptions): Promise<CombinedReconciliationView> {
  const { date, classId, q } = options

  const dateObj = new Date(date + 'T00:00:00.000Z')
  const dayOfWeek = dateObj.getUTCDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new AppError('Cannot reconcile for a weekend date. Select a school day.', HttpStatus.BadRequest)
  }

  const session = await prisma.academicSession.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  })
  if (!session) {
    throw new AppError('No active academic session found.', HttpStatus.BadRequest)
  }

  const term = await prisma.academicTerm.findFirst({
    where: { sessionId: session.id, status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { termNumber: 'desc' },
  })
  if (!term) {
    throw new AppError('No active academic term found.', HttpStatus.BadRequest)
  }

  // Find DAILY and PA fee structures for this session+term
  const [dailyFee, paFee] = await Promise.all([
    prisma.financeFee.findFirst({
      where: { sessionId: session.id, termId: term.id, feeType: 'DAILY', status: 'ACTIVE' },
      select: { id: true, amount: true },
    }),
    prisma.financeFee.findFirst({
      where: { sessionId: session.id, termId: term.id, feeType: 'PA', status: 'ACTIVE' },
      select: { id: true, amount: true },
    }),
  ])

  if (!dailyFee) {
    throw new AppError('No active Daily Fee structure found for the current term.', HttpStatus.BadRequest)
  }
  if (!paFee) {
    throw new AppError('No active PA Fee structure found for the current term.', HttpStatus.BadRequest)
  }

  // Fetch active pupils (optionally filtered by class and search)
  const pupilWhere: Prisma.PupilWhereInput = { status: 'ACTIVE' }
  if (classId) {
    pupilWhere.classId = classId
  }
  if (q) {
    pupilWhere.OR = [
      { pupilId: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
    ]
  }

  const pupils = await prisma.pupil.findMany({
    where: pupilWhere,
    include: { class: { select: { id: true, name: true } } },
    orderBy: { firstName: 'asc' },
  })

  const pupilIds = pupils.map((p) => p.id)

  // Attendance for the date
  const attendanceRecords = pupilIds.length > 0
    ? await prisma.attendance.findMany({
        where: {
          date: dateObj,
          pupilId: { in: pupilIds },
          sessionId: session.id,
        },
        select: { pupilId: true, status: true },
      })
    : []
  const attendanceMap = new Map<string, string>()
  for (const r of attendanceRecords) {
    if (r.pupilId) attendanceMap.set(r.pupilId, r.status)
  }

  // Fee assignments for DAILY and PA
  const [dailyAssignments, paAssignments] = await Promise.all([
    dailyFee
      ? prisma.feeAssignment.findMany({
          where: { feeId: dailyFee.id, pupilId: { in: pupilIds }, status: { in: ['ACTIVE', 'EXEMPT'] } },
          select: { pupilId: true, status: true },
        })
      : [],
    paFee
      ? prisma.feeAssignment.findMany({
          where: { feeId: paFee.id, pupilId: { in: pupilIds }, status: { in: ['ACTIVE', 'EXEMPT'] } },
          select: { pupilId: true, status: true },
        })
      : [],
  ])

  const dailyAssignmentMap = new Map<string, 'ACTIVE' | 'EXEMPT'>()
  for (const a of dailyAssignments) dailyAssignmentMap.set(a.pupilId, a.status as 'ACTIVE' | 'EXEMPT')

  const paAssignmentMap = new Map<string, 'ACTIVE' | 'EXEMPT'>()
  for (const a of paAssignments) paAssignmentMap.set(a.pupilId, a.status as 'ACTIVE' | 'EXEMPT')

  // Payments for this date — look at allocations for charges belonging to DAILY and PA fees
  const [dailyDayPayments, paDayPayments] = await Promise.all([
    dailyFee
      ? prisma.paymentAllocation.findMany({
          where: {
            payment: { status: 'ACTIVE', paymentDate: dateObj },
            charge: {
              assignment: {
                feeId: dailyFee.id,
                pupilId: { in: pupilIds },
              },
            },
          },
          select: {
            amount: true,
            charge: { select: { assignment: { select: { pupilId: true } } } },
          },
        })
      : [],
    paFee
      ? prisma.paymentAllocation.findMany({
          where: {
            payment: { status: 'ACTIVE', paymentDate: dateObj },
            charge: {
              assignment: {
                feeId: paFee.id,
                pupilId: { in: pupilIds },
              },
            },
          },
          select: {
            amount: true,
            charge: { select: { assignment: { select: { pupilId: true } } } },
          },
        })
      : [],
  ])

  const dailyPaidByPupil = new Map<string, Prisma.Decimal>()
  for (const alloc of dailyDayPayments) {
    const pid = alloc.charge.assignment.pupilId
    dailyPaidByPupil.set(pid, (dailyPaidByPupil.get(pid) ?? new Prisma.Decimal(0)).plus(alloc.amount))
  }

  const paPaidByPupil = new Map<string, Prisma.Decimal>()
  for (const alloc of paDayPayments) {
    const pid = alloc.charge.assignment.pupilId
    paPaidByPupil.set(pid, (paPaidByPupil.get(pid) ?? new Prisma.Decimal(0)).plus(alloc.amount))
  }

  // Group pupils by class
  const classMap = new Map<string, { id: string; name: string; pupils: typeof pupils }>()
  for (const pupil of pupils) {
    const classId = pupil.classId
    if (!classMap.has(classId)) {
      classMap.set(classId, { id: classId, name: pupil.class.name, pupils: [] })
    }
    classMap.get(classId)!.pupils.push(pupil)
  }

  // Check if this day is closed
  const closeRecord = await prisma.dailyReconciliationClose.findUnique({
    where: { date: dateObj },
    include: { closedBy: { select: { fullName: true } } },
  })
  const isClosed = !!closeRecord
  const closedAt = closeRecord?.closedAt?.toISOString() ?? null
  const closedByName = closeRecord?.closedBy?.fullName ?? null

  // Build per-pupil rows
  const dailyFeeAmt = dailyFee.amount
  const paFeeAmt = paFee.amount

  const classSummaries: CombinedReconciliationClassSummary[] = []
  let totalPupils = 0
  let presentCount = 0
  let absentCount = 0
  let dailyPaidCount = 0
  let dailyNotPaidCount = 0
  let paPaidCount = 0
  let paNotPaidCount = 0
  let fullyPaidCount = 0
  let partiallyPaidCount = 0
  let notPaidCount = 0
  let exemptCount = 0
  let totalOutstanding = new Prisma.Decimal(0)
  let totalDailyCollected = new Prisma.Decimal(0)
  let totalPaCollected = new Prisma.Decimal(0)

  for (const [clsId, clsData] of classMap.entries()) {
    const pupilRows: CombinedReconciliationPupilRow[] = []
    let clsPresent = 0
    let clsAbsent = 0

    for (const pupil of clsData.pupils) {
      const attendanceStatus = attendanceMap.get(pupil.id) ?? null
      const isAbsent = !attendanceStatus || attendanceStatus !== 'PRESENT'

      const dailyAssignmentStatus = dailyAssignmentMap.get(pupil.id) ?? null
      const paAssignmentStatus = paAssignmentMap.get(pupil.id) ?? null

      const dailyExempt = dailyAssignmentStatus === 'EXEMPT'
      const paExempt = paAssignmentStatus === 'EXEMPT'

      // Payment amounts are independent of attendance
      const dailyPaidAmt = dailyExempt
        ? new Prisma.Decimal(0)
        : (dailyPaidByPupil.get(pupil.id) ?? new Prisma.Decimal(0))

      const paPaidAmt = paExempt
        ? new Prisma.Decimal(0)
        : (paPaidByPupil.get(pupil.id) ?? new Prisma.Decimal(0))

      // Daily Fee status: attendance and payment are independent
      let dailyStatus: ReconciliationStatus
      if (dailyExempt) {
        dailyStatus = 'EXEMPT'
      } else if (dailyPaidAmt.gte(dailyFeeAmt)) {
        dailyStatus = 'PAID'
      } else if (dailyPaidAmt.gt(0)) {
        dailyStatus = 'PAID' // Partially paid treated as PAID for per-fee status
      } else {
        dailyStatus = 'NOT_PAID'
      }

      // PA Fee status: attendance and payment are independent
      let paStatus: ReconciliationStatus
      if (paExempt) {
        paStatus = 'EXEMPT'
      } else if (paPaidAmt.gte(paFeeAmt)) {
        paStatus = 'PAID'
      } else if (paPaidAmt.gt(0)) {
        paStatus = 'PAID'
      } else {
        paStatus = 'NOT_PAID'
      }

      // Outstanding calculation — attendance does not zero out outstanding
      const dailyOutstanding = dailyExempt || dailyPaidAmt.gte(dailyFeeAmt)
        ? new Prisma.Decimal(0)
        : dailyFeeAmt.minus(dailyPaidAmt)

      const paOutstanding = paExempt || paPaidAmt.gte(paFeeAmt)
        ? new Prisma.Decimal(0)
        : paFeeAmt.minus(paPaidAmt)

      const outstanding = dailyOutstanding.plus(paOutstanding)

      // Overall finance status
      let overallStatus: DailyFinanceStatus
      if (isAbsent) {
        overallStatus = 'ABSENT'
      } else if (dailyExempt && paExempt) {
        overallStatus = 'EXEMPT'
      } else if (dailyExempt || paExempt) {
        overallStatus = 'EXEMPT'
      } else if (dailyPaidAmt.gte(dailyFeeAmt) && paPaidAmt.gte(paFeeAmt)) {
        overallStatus = 'PAID'
      } else if (dailyPaidAmt.gte(dailyFeeAmt) || paPaidAmt.gte(paFeeAmt)) {
        overallStatus = outstanding.gt(0) ? 'PARTIALLY_PAID' : 'PAID'
      } else if (outstanding.gt(0)) {
        overallStatus = 'NOT_PAID'
      } else {
        overallStatus = 'PAID'
      }

      // Update counters
      if (isAbsent) {
        absentCount += 1
        clsAbsent += 1
      } else {
        presentCount += 1
        clsPresent += 1
        if (dailyExempt || paExempt) {
          exemptCount += 1
        } else {
          if (dailyStatus === 'PAID') dailyPaidCount += 1
          else dailyNotPaidCount += 1
          if (paStatus === 'PAID') paPaidCount += 1
          else paNotPaidCount += 1
          if (overallStatus === 'PAID') fullyPaidCount += 1
          else if (overallStatus === 'PARTIALLY_PAID') partiallyPaidCount += 1
          else notPaidCount += 1
        }
      }

      totalOutstanding = totalOutstanding.plus(outstanding)
      totalDailyCollected = totalDailyCollected.plus(dailyPaidAmt)
      totalPaCollected = totalPaCollected.plus(paPaidAmt)

      pupilRows.push({
        pupilId: pupil.id,
        pupilCode: pupil.pupilId,
        fullName: `${pupil.firstName} ${pupil.lastName}`.trim(),
        className: pupil.class.name,
        classId: pupil.classId,
        attendanceStatus,
        dailyAssignmentStatus,
        paAssignmentStatus,
        dailyFeeAmount: money(dailyFeeAmt),
        dailyPaidAmount: money(dailyPaidAmt),
        dailyStatus,
        paFeeAmount: money(paFeeAmt),
        paPaidAmount: money(paPaidAmt),
        paStatus,
        outstanding: money(outstanding),
        overallStatus,
      })
    }

    classSummaries.push({
      classId: clsId,
      className: clsData.name,
      totalPupils: clsData.pupils.length,
      presentCount: clsPresent,
      absentCount: clsAbsent,
      pupils: pupilRows,
    })

    totalPupils += clsData.pupils.length
  }

  return {
    date,
    sessionId: session.id,
    sessionName: session.name,
    termName: term.name,
    dailyFeeAmount: money(dailyFeeAmt),
    paFeeAmount: money(paFeeAmt),
    isClosed,
    closedAt,
    closedByName,
    classes: classSummaries,
    totals: {
      totalPupils,
      presentCount,
      absentCount,
      dailyPaidCount,
      dailyNotPaidCount,
      paPaidCount,
      paNotPaidCount,
      fullyPaidCount,
      partiallyPaidCount,
      notPaidCount,
      exemptCount,
      totalOutstanding: money(totalOutstanding),
      totalDailyCollected: money(totalDailyCollected),
      totalPaCollected: money(totalPaCollected),
    },
  }
}

// ---------------------------------------------------------------------------
// Daily Reconciliation Close / Sign-off — locks a specific school day.
// ---------------------------------------------------------------------------

export async function closeDailyReconciliation(
  actor: AuthenticatedUser,
  date: string,
  ip?: string,
): Promise<DailyReconciliationCloseView> {
  const dateObj = new Date(date + 'T00:00:00.000Z')
  const dayOfWeek = dateObj.getUTCDay()
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    throw new AppError('Cannot close reconciliation for a weekend date.', HttpStatus.BadRequest)
  }

  const session = await prisma.academicSession.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
  })
  if (!session) {
    throw new AppError('No active academic session found.', HttpStatus.BadRequest)
  }

  const term = await prisma.academicTerm.findFirst({
    where: { sessionId: session.id, status: 'ACTIVE' },
    select: { id: true, name: true },
  })
  if (!term) {
    throw new AppError('No active academic term found.', HttpStatus.BadRequest)
  }

  // Check if already closed
  const existing = await prisma.dailyReconciliationClose.findUnique({
    where: { date: dateObj },
  })
  if (existing) {
    throw new AppError(
      'This day\'s financial reconciliation has already been closed and signed.',
      HttpStatus.Conflict,
    )
  }

  // Build summary metadata
  const summary = await buildDailyReconciliationSummary(dateObj, session.id, term.id)

  const closeRecord = await prisma.dailyReconciliationClose.create({
    data: {
      date: dateObj,
      sessionId: session.id,
      termId: term.id,
      closedById: actor.id,
      metadata: summary as unknown as Prisma.InputJsonValue,
    },
    include: { closedBy: { select: { fullName: true } } },
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'finance.reconciliation.close',
    resourceType: 'daily_reconciliation_close',
    resourceId: closeRecord.id,
    metadata: {
      date,
      sessionName: session.name,
      termName: term.name,
      totalPupils: summary.totalPupils,
      presentCount: summary.presentCount,
      absentCount: summary.absentCount,
      totalOutstanding: summary.totalOutstanding,
    },
    ip: ip ?? null,
  })

  return {
    id: closeRecord.id,
    date: date,
    sessionId: session.id,
    termId: term.id,
    closedById: actor.id,
    closedByName: closeRecord.closedBy.fullName,
    closedAt: closeRecord.closedAt.toISOString(),
  }
}

export async function getDailyReconciliationCloseStatus(
  date: string,
): Promise<DailyReconciliationCloseView | null> {
  const dateObj = new Date(date + 'T00:00:00.000Z')
  const closeRecord = await prisma.dailyReconciliationClose.findUnique({
    where: { date: dateObj },
    include: { closedBy: { select: { id: true, fullName: true } } },
  })
  if (!closeRecord) return null
  return {
    id: closeRecord.id,
    date: date,
    sessionId: closeRecord.sessionId,
    termId: closeRecord.termId,
    closedById: closeRecord.closedBy.id,
    closedByName: closeRecord.closedBy.fullName,
    closedAt: closeRecord.closedAt.toISOString(),
  }
}

/**
 * Check if a given date's reconciliation is locked.
 * Throws 409 Conflict if locked.
 */
async function assertReconciliationNotLocked(date: Date): Promise<void> {
  const existing = await prisma.dailyReconciliationClose.findUnique({
    where: { date },
  })
  if (existing) {
    throw new AppError(
      'This day\'s financial reconciliation has already been closed and signed and cannot be changed.',
      HttpStatus.Conflict,
    )
  }
}

async function buildDailyReconciliationSummary(
  dateObj: Date,
  sessionId: string,
  termId: string,
): Promise<{ totalPupils: number; presentCount: number; absentCount: number; totalOutstanding: string; totalDailyCollected: string; totalPaCollected: string }> {
  const dailyFee = await prisma.financeFee.findFirst({
    where: { sessionId, termId, feeType: 'DAILY', status: 'ACTIVE' },
    select: { id: true, amount: true },
  })
  const paFee = await prisma.financeFee.findFirst({
    where: { sessionId, termId, feeType: 'PA', status: 'ACTIVE' },
    select: { id: true, amount: true },
  })

  const pupils = await prisma.pupil.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true },
  })
  const pupilIds = pupils.map((p) => p.id)

  const attendanceRecords = pupilIds.length > 0
    ? await prisma.attendance.findMany({
        where: { date: dateObj, pupilId: { in: pupilIds }, sessionId },
        select: { pupilId: true, status: true },
      })
    : []
  const attendanceMap = new Map<string, string>()
  for (const r of attendanceRecords) {
    if (r.pupilId) attendanceMap.set(r.pupilId, r.status)
  }

  let presentCount = 0
  let absentCount = 0
  for (const pid of pupilIds) {
    const st = attendanceMap.get(pid)
    if (st === 'PRESENT') presentCount += 1
    else absentCount += 1
  }

  let totalOutstanding = '0.00'
  let totalDailyCollected = '0.00'
  let totalPaCollected = '0.00'

  if (dailyFee || paFee) {
    const [dailyAllocs, paAllocs] = await Promise.all([
      dailyFee
        ? prisma.paymentAllocation.findMany({
            where: {
              payment: { status: 'ACTIVE', paymentDate: dateObj },
              charge: { assignment: { feeId: dailyFee.id, pupilId: { in: pupilIds } } },
            },
            select: { amount: true },
          })
        : [],
      paFee
        ? prisma.paymentAllocation.findMany({
            where: {
              payment: { status: 'ACTIVE', paymentDate: dateObj },
              charge: { assignment: { feeId: paFee.id, pupilId: { in: pupilIds } } },
            },
            select: { amount: true },
          })
        : [],
    ])

    const dailyCollected = dailyAllocs.reduce((s, a) => s.plus(a.amount), new Prisma.Decimal(0))
    const paCollected = paAllocs.reduce((s, a) => s.plus(a.amount), new Prisma.Decimal(0))

    const expectedDaily = dailyFee ? new Prisma.Decimal(dailyFee.amount).times(presentCount) : new Prisma.Decimal(0)
    const expectedPa = paFee ? new Prisma.Decimal(paFee.amount).times(presentCount) : new Prisma.Decimal(0)

    const dailyOutstanding = expectedDaily.minus(dailyCollected)
    const paOutstanding = expectedPa.minus(paCollected)

    totalOutstanding = dailyOutstanding.plus(paOutstanding).toFixed(2)
    totalDailyCollected = dailyCollected.toFixed(2)
    totalPaCollected = paCollected.toFixed(2)
  }

  return {
    totalPupils: pupils.length,
    presentCount,
    absentCount,
    totalOutstanding,
    totalDailyCollected,
    totalPaCollected,
  }
}