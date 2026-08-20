import { Prisma } from '@prisma/client'

/**
 * Finance view DTOs and helpers. Amounts are always exposed as fixed two
 * decimal-place strings so money never loses precision crossing the JSON
 * boundary, and the backend remains authoritative for financial truth.
 */

export type FeeTypeValue = 'TERMLY' | 'DAILY' | 'OTHER'
export type PaymentMethodValue = 'CASH' | 'BANK_TRANSFER' | 'MOBILE_MONEY' | 'CHEQUE'
export type AccountStatusValue = 'ACTIVE' | 'INACTIVE'
export type PaymentRecordStatusValue = 'ACTIVE' | 'VOIDED'

export function money(value: Prisma.Decimal | string | number | null | undefined): string {
  if (value === null || value === undefined) return '0.00'
  return new Prisma.Decimal(value).toFixed(2)
}

export interface SessionWithCounts {
  id: string
  name: string
  startDate: Date
  endDate: Date
  status: AccountStatusValue
  createdAt: Date
  updatedAt: Date
  _count?: { terms: number; fees: number }
}

export interface AcademicSessionView {
  id: string
  name: string
  startDate: string
  endDate: string
  status: AccountStatusValue
  termCount: number
  feeCount: number
  createdAt: string
  updatedAt: string
}

export function toSessionView(session: SessionWithCounts): AcademicSessionView {
  return {
    id: session.id,
    name: session.name,
    startDate: session.startDate.toISOString(),
    endDate: session.endDate.toISOString(),
    status: session.status,
    termCount: session._count?.terms ?? 0,
    feeCount: session._count?.fees ?? 0,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
  }
}

export interface AcademicTermRecord {
  id: string
  sessionId: string
  name: string
  termNumber: number
  startDate: Date
  endDate: Date
  schoolDays: number
  status: AccountStatusValue
}

export interface AcademicTermView {
  id: string
  sessionId: string
  name: string
  termNumber: number
  startDate: string
  endDate: string
  schoolDays: number
  status: AccountStatusValue
}

export function toTermView(term: AcademicTermRecord): AcademicTermView {
  return {
    id: term.id,
    sessionId: term.sessionId,
    name: term.name,
    termNumber: term.termNumber,
    startDate: term.startDate.toISOString(),
    endDate: term.endDate.toISOString(),
    schoolDays: term.schoolDays,
    status: term.status,
  }
}

export interface FeeRecord {
  id: string
  sessionId: string
  sessionName?: string
  name: string
  feeType: FeeTypeValue
  amount: Prisma.Decimal
  description: string | null
  status: AccountStatusValue
  createdAt: Date
  updatedAt: Date
  assignmentCount?: number
  activeAssignmentCount?: number
  chargeCount?: number
}

export interface FeeView {
  id: string
  sessionId: string
  sessionName: string
  name: string
  feeType: FeeTypeValue
  amount: string
  description: string | null
  status: AccountStatusValue
  assignmentCount: number
  activeAssignmentCount: number
  chargeCount: number
  createdAt: string
  updatedAt: string
}

export function toFeeView(fee: FeeRecord): FeeView {
  return {
    id: fee.id,
    sessionId: fee.sessionId,
    sessionName: fee.sessionName ?? '—',
    name: fee.name,
    feeType: fee.feeType,
    amount: money(fee.amount),
    description: fee.description,
    status: fee.status,
    assignmentCount: fee.assignmentCount ?? 0,
    activeAssignmentCount: fee.activeAssignmentCount ?? 0,
    chargeCount: fee.chargeCount ?? 0,
    createdAt: fee.createdAt.toISOString(),
    updatedAt: fee.updatedAt.toISOString(),
  }
}

export interface FeeAssignmentView {
  id: string
  pupilId: string
  pupilCode: string
  pupilName: string
  className: string
  feeId: string
  feeName: string
  status: AccountStatusValue
  chargeCount: number
  createdAt: string
}

export interface PaymentAllocationRecord {
  id: string
  chargeId: string
  amount: Prisma.Decimal
  charge?: {
    assignment?: {
      fee?: { id: string; name: string }
    }
    term?: { id: string; name: string } | null
  } | null
}

export interface PaymentRecord {
  id: string
  paymentReference: string
  pupilId: string
  amountPaid: Prisma.Decimal
  paymentMethod: PaymentMethodValue
  paymentDate: Date
  note: string | null
  receivedById: string
  status: PaymentRecordStatusValue
  voidedAt: Date | null
  voidedById: string | null
  voidReason: string | null
  createdAt: Date
  pupil?: { id: string; pupilId: string; firstName: string; lastName: string } | null
  allocations?: PaymentAllocationRecord[]
}

export interface PaymentAllocationView {
  id: string
  chargeId: string
  feeName: string
  termName: string | null
  amount: string
}

export interface PaymentView {
  id: string
  paymentReference: string
  pupilId: string
  pupilCode: string
  pupilName: string
  amountPaid: string
  paymentMethod: PaymentMethodValue
  paymentDate: string
  note: string | null
  receivedById: string
  receivedByName: string
  status: PaymentRecordStatusValue
  voidedAt: string | null
  voidedById: string | null
  voidReason: string | null
  allocations: PaymentAllocationView[]
  createdAt: string
}

export function toPaymentView(
  payment: PaymentRecord,
  userNames: Record<string, string>,
): PaymentView {
  const first = payment.pupil?.firstName ?? ''
  const last = payment.pupil?.lastName ?? ''
  return {
    id: payment.id,
    paymentReference: payment.paymentReference,
    pupilId: payment.pupilId,
    pupilCode: payment.pupil?.pupilId ?? '',
    pupilName: first || last ? `${first} ${last}`.trim() : '',
    amountPaid: money(payment.amountPaid),
    paymentMethod: payment.paymentMethod,
    paymentDate: payment.paymentDate.toISOString(),
    note: payment.note,
    receivedById: payment.receivedById,
    receivedByName: userNames[payment.receivedById] ?? '—',
    status: payment.status,
    voidedAt: payment.voidedAt?.toISOString() ?? null,
    voidedById: payment.voidedById,
    voidReason: payment.voidReason,
    allocations: (payment.allocations ?? []).map((allocation) => ({
      id: allocation.id,
      chargeId: allocation.chargeId,
      feeName: allocation.charge?.assignment?.fee?.name ?? 'Fee',
      termName: allocation.charge?.term?.name ?? null,
      amount: money(allocation.amount),
    })),
    createdAt: payment.createdAt.toISOString(),
  }
}

export interface FinancePupilView {
  id: string
  pupilId: string
  fullName: string
  className: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface PupilChargeView {
  id: string
  feeId: string
  feeName: string
  termId: string | null
  termName: string | null
  amount: string
  paid: string
  balance: string
}

export interface PupilFinanceView {
  pupil: { id: string; pupilId: string; fullName: string; className: string }
  totalDue: string
  totalPaid: string
  outstanding: string
  charges: PupilChargeView[]
  payments: PaymentView[]
}

export interface FeeSummaryView {
  total: number
  active: number
  byType: Record<FeeTypeValue, number>
}

export interface FinanceSummaryView {
  session: AcademicSessionView | null
  term: AcademicTermView | null
  expectedFees: string
  collected: string
  outstanding: string
  pupilsWithOutstanding: number
  paymentsThisTerm: string
  paymentsThisTermCount: number
  feeSummary: FeeSummaryView
  recentPayments: PaymentView[]
}

export interface AssignFeesResult {
  assigned: number
  skipped: number
}

export interface ChargeGenerateResult {
  created: number
}