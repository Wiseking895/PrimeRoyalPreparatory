import { Prisma } from '@prisma/client'
import { HEADTEACHER_ROLE, OWNER_ONLY_PERMISSIONS, PERMISSIONS } from '../rbac/catalog'
import { HttpStatus } from '../config/enums'
import { logger } from '../config/logger'
import { hashPassword } from '../lib/password'
import { generateTemporaryPassword } from '../lib/temporary-password'
import { prisma } from '../lib/prisma'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import { ensureInitialRbac } from './ensure-rbac'
import { maskEmail, sendHeadteacherInvitation, type MailResult } from './mail.service'
import { toPublicUser, toStaffView, type PublicUser, type StaffView } from './user-mapper'
import { money } from './finance-mapper'

const headteacherInclude = {
  staffProfile: true,
  roles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
} as const

export interface HeadteacherCreateInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface HeadteacherUpdateInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
}

export type InvitationResult = MailResult

export interface HeadteacherCreateResult {
  headteacher: PublicUser
  invitation: InvitationResult
}

async function nextHeadteacherStaffId(): Promise<string> {
  const count = await prisma.staffProfile.count({ where: { staffId: { startsWith: 'PRPS-HT-' } } })
  return `PRPS-HT-${String(count + 1).padStart(3, '0')}`
}

function isHeadteacherUser(user: { roles: Array<{ role: { name: string } }> }): boolean {
  return user.roles.some(({ role }) => role.name === HEADTEACHER_ROLE)
}

async function assertEmailAvailable(email: string, excludeUserId?: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (existing && existing.id !== excludeUserId) {
    throw new AppError('An account with this email already exists.', HttpStatus.Conflict)
  }
}

export async function getOwnerSummary(): Promise<{
  headteacher: PublicUser | null
  totals: {
    staff: number
    teaching: number
    nonTeaching: number
    activeStaff: number
    inactiveStaff: number
    headteachers: number
    pupils: number
    activePupils: number
    inactivePupils: number
    classes: number
    admissions: number
    auditEntries: number
  }
  pupilsByClass: Array<{
    classId: string
    className: string
    boys: number
    girls: number
    total: number
  }>
  recentStaffActivity: Array<{
    id: string
    action: string
    createdAt: Date
    actor: { id: string; fullName: string; email: string } | null
  }>
  recentPermissionChanges: Array<{
    id: string
    action: string
    metadata: unknown
    createdAt: Date
    actor: { id: string; fullName: string; email: string } | null
  }>
}> {
  const [
    headteacher,
    staffCount,
    teachingCount,
    nonTeachingCount,
    activeStaffCount,
    inactiveStaffCount,
    headteacherCount,
    auditEntries,
    pupilCount,
    activePupilCount,
    inactivePupilCount,
    classCount,
    pupilGroupBy,
    staffActivity,
    permissionChanges,
  ] = await Promise.all([
    prisma.user.findFirst({
      where: { roles: { some: { role: { name: HEADTEACHER_ROLE } } } },
      include: headteacherInclude,
    }),
    prisma.staffProfile.count({ where: { category: { in: ['TEACHING', 'NON_TEACHING'] } } }),
    prisma.staffProfile.count({ where: { category: 'TEACHING' } }),
    prisma.staffProfile.count({ where: { category: 'NON_TEACHING' } }),
    prisma.staffProfile.count({
      where: { category: { in: ['TEACHING', 'NON_TEACHING'] }, user: { is: { status: 'ACTIVE' } } },
    }),
    prisma.staffProfile.count({
      where: { category: { in: ['TEACHING', 'NON_TEACHING'] }, user: { is: { status: 'INACTIVE' } } },
    }),
    prisma.user.count({ where: { roles: { some: { role: { name: HEADTEACHER_ROLE } } } } }),
    prisma.auditLog.count(),
    prisma.pupil.count(),
    prisma.pupil.count({ where: { status: 'ACTIVE' } }),
    prisma.pupil.count({ where: { status: 'INACTIVE' } }),
    prisma.schoolClass.count(),
    prisma.pupil.groupBy({ by: ['classId', 'gender'], _count: { _all: true } }),
    prisma.auditLog.findMany({
      where: { action: { startsWith: 'staff.' } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { actorUser: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.auditLog.findMany({
      where: { action: { startsWith: 'owner.headteacher.permissions.' } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { actorUser: { select: { id: true, fullName: true, email: true } } },
    }),
  ])

  const classIds = [...new Set(pupilGroupBy.map((row) => row.classId))]
  const classes = classIds.length > 0
    ? await prisma.schoolClass.findMany({
        where: { id: { in: classIds } },
        select: { id: true, name: true },
      })
    : []
  const classMap = new Map(classes.map((entry) => [entry.id, entry.name]))

  const classAggregates = new Map<string, { boys: number; girls: number }>()
  for (const row of pupilGroupBy) {
    const existing = classAggregates.get(row.classId) ?? { boys: 0, girls: 0 }
    if (row.gender === 'MALE') {
      existing.boys = row._count._all
    } else {
      existing.girls = row._count._all
    }
    classAggregates.set(row.classId, existing)
  }

  const pupilsByClass = Array.from(classAggregates.entries())
    .map(([classId, agg]) => ({
      classId,
      className: classMap.get(classId) ?? '—',
      boys: agg.boys,
      girls: agg.girls,
      total: agg.boys + agg.girls,
    }))
    .sort((a, b) => a.className.localeCompare(b.className))

  return {
    headteacher: headteacher ? toPublicUser(headteacher) : null,
    totals: {
      staff: staffCount,
      teaching: teachingCount,
      nonTeaching: nonTeachingCount,
      activeStaff: activeStaffCount,
      inactiveStaff: inactiveStaffCount,
      headteachers: headteacherCount,
      pupils: pupilCount,
      activePupils: activePupilCount,
      inactivePupils: inactivePupilCount,
      classes: classCount,
      // Later phases own the admissions count.
      admissions: 0,
      auditEntries,
    },
    pupilsByClass,
    recentStaffActivity: staffActivity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      createdAt: entry.createdAt,
      actor: entry.actorUser,
    })),
    recentPermissionChanges: permissionChanges.map((entry) => ({
      id: entry.id,
      action: entry.action,
      metadata: entry.metadata,
      createdAt: entry.createdAt,
      actor: entry.actorUser,
    })),
  }
}

// =============================================================================
// Owner Finance Overview (read-only)
// =============================================================================

export interface ClassFinanceRow {
  classId: string
  className: string
  pupilCount: number
  expectedAmount: string
  collectedAmount: string
  outstandingAmount: string
}

export interface OwnerFinanceOverviewView {
  session: { id: string; name: string } | null
  term: { id: string; name: string } | null
  totals: {
    totalExpected: string
    totalCollected: string
    totalOutstanding: string
    totalPupils: number
    pupilsWithCharges: number
    pupilsWithPayments: number
  }
  dailyFees: ClassFinanceRow[]
  ptaFees: ClassFinanceRow[]
  maintenanceFees: ClassFinanceRow[]
  paFees: ClassFinanceRow[]
}

export async function getOwnerFinanceOverview(targetDate?: string): Promise<OwnerFinanceOverviewView> {
  const session = await prisma.academicSession.findFirst({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { createdAt: 'desc' },
  })
  const term = session
    ? await prisma.academicTerm.findFirst({
        where: { sessionId: session.id, status: 'ACTIVE' },
        select: { id: true, name: true, startDate: true, endDate: true },
        orderBy: { termNumber: 'desc' },
      })
    : null

  // Get all active classes
  const classes = await prisma.schoolClass.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { sortOrder: 'asc' },
  })

  if (classes.length === 0 || !session || !term) {
    return {
      session,
      term: term ? { id: term.id, name: term.name } : null,
      totals: {
        totalExpected: money(0),
        totalCollected: money(0),
        totalOutstanding: money(0),
        totalPupils: 0,
        pupilsWithCharges: 0,
        pupilsWithPayments: 0,
      },
      dailyFees: [],
      ptaFees: [],
      maintenanceFees: [],
      paFees: [],
    }
  }

  const classIds = classes.map((c) => c.id)

  // Determine the target date for daily calculation
  // Use provided date or today's date
  const dateStr = targetDate || new Date().toISOString().slice(0, 10)
  const targetDateObj = new Date(dateStr + 'T00:00:00.000Z')

  // Check if target date is a weekday (Mon-Fri)
  const dayOfWeek = targetDateObj.getUTCDay()
  const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5

  // Get all active fee structures for this session+term
  const fees = await prisma.financeFee.findMany({
    where: { sessionId: session.id, termId: term.id, status: 'ACTIVE' },
    select: { id: true, feeType: true, amount: true },
  })

  const dailyFee = fees.find((f) => f.feeType === 'DAILY')
  const paFee = fees.find((f) => f.feeType === 'PA')

  // Get attendance for the target date (pupils present today)
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      date: targetDateObj,
      pupilId: { not: null },
      sessionId: session.id,
      classId: { in: classIds },
      status: 'PRESENT',
    },
    select: { pupilId: true, classId: true },
  })

  // Build set of present pupils by class
  const presentByClass = new Map<string, Set<string>>()
  for (const cls of classes) {
    presentByClass.set(cls.id, new Set())
  }
  for (const record of attendanceRecords) {
    if (record.pupilId && record.classId) {
      const set = presentByClass.get(record.classId)
      if (set) set.add(record.pupilId)
    }
  }

  // Get all active pupils by class (for termly/other fees)
  const pupilsByClass = await prisma.pupil.groupBy({
    by: ['classId'],
    where: { classId: { in: classIds }, status: 'ACTIVE' },
    _count: { _all: true },
  })
  const pupilCountByClass = new Map<string, number>()
  for (const row of pupilsByClass) {
    pupilCountByClass.set(row.classId, row._count._all)
  }

  // Get fee assignments for exemptions
  const dailyAssignments = dailyFee
    ? await prisma.feeAssignment.findMany({
        where: { feeId: dailyFee.id, status: { in: ['ACTIVE', 'EXEMPT'] } },
        select: { pupilId: true, status: true },
      })
    : []
  const paAssignments = paFee
    ? await prisma.feeAssignment.findMany({
        where: { feeId: paFee.id, status: { in: ['ACTIVE', 'EXEMPT'] } },
        select: { pupilId: true, status: true },
      })
    : []

  const dailyExemptPupils = new Set(dailyAssignments.filter((a) => a.status === 'EXEMPT').map((a) => a.pupilId))
  const paExemptPupils = new Set(paAssignments.filter((a) => a.status === 'EXEMPT').map((a) => a.pupilId))

  // Get payments for the target date
  const dayPayments = await prisma.payment.findMany({
    where: {
      status: 'ACTIVE',
      paymentDate: targetDateObj,
      allocations: {
        some: {
          charge: {
            assignment: {
              fee: { sessionId: session.id, termId: term.id },
              pupil: { classId: { in: classIds }, status: 'ACTIVE' },
            },
          },
        },
      },
    },
    select: {
      pupilId: true,
      amountPaid: true,
      allocations: {
        select: {
          amount: true,
          charge: {
            select: {
              assignment: {
                select: {
                  pupilId: true,
                  pupil: { select: { classId: true } },
                  fee: { select: { feeType: true } },
                },
              },
            },
          },
        },
      },
    },
  })

  // Get termly charges for TERMLY and OTHER fees
  const termCharges = await prisma.feeCharge.findMany({
    where: {
      status: 'ACTIVE',
      termId: term.id,
      assignment: {
        status: 'ACTIVE',
        fee: { sessionId: session.id },
        pupil: { classId: { in: classIds }, status: 'ACTIVE' },
      },
    },
    select: {
      id: true,
      amount: true,
      assignment: {
        select: {
          pupilId: true,
          pupil: { select: { classId: true } },
          fee: { select: { feeType: true } },
        },
      },
      allocations: {
        select: {
          amount: true,
          payment: { select: { status: true, paymentDate: true } },
        },
      },
    },
  })

  // Aggregate by class and fee type
  type FeeTypeKey = 'DAILY' | 'TERMLY' | 'OTHER' | 'PA'
  const byClassAndType = new Map<string, Map<FeeTypeKey, { expected: Prisma.Decimal; collected: Prisma.Decimal; pupilCount: Set<string>; exemptCount: Set<string> }>>()

  for (const cls of classes) {
    byClassAndType.set(cls.id, new Map([
      ['DAILY', { expected: new Prisma.Decimal(0), collected: new Prisma.Decimal(0), pupilCount: new Set(), exemptCount: new Set() }],
      ['TERMLY', { expected: new Prisma.Decimal(0), collected: new Prisma.Decimal(0), pupilCount: new Set(), exemptCount: new Set() }],
      ['OTHER', { expected: new Prisma.Decimal(0), collected: new Prisma.Decimal(0), pupilCount: new Set(), exemptCount: new Set() }],
      ['PA', { expected: new Prisma.Decimal(0), collected: new Prisma.Decimal(0), pupilCount: new Set(), exemptCount: new Set() }],
    ]))
  }

  const allPupilsWithCharges = new Set<string>()
  const allPupilsWithPayments = new Set<string>()
  let totalExpected = new Prisma.Decimal(0)
  let totalCollected = new Prisma.Decimal(0)

  // Calculate DAILY fees: rate × pupils present today (excluding exempt)
  if (dailyFee && isWeekday) {
    for (const cls of classes) {
      const presentPupils = presentByClass.get(cls.id) ?? new Set()
      const bucket = byClassAndType.get(cls.id)?.get('DAILY')
      if (!bucket) continue

      let eligibleCount = 0
      for (const pupilId of presentPupils) {
        if (!dailyExemptPupils.has(pupilId)) {
          eligibleCount++
          bucket.pupilCount.add(pupilId)
          allPupilsWithCharges.add(pupilId)
        } else {
          bucket.exemptCount.add(pupilId)
        }
      }

      const expected = dailyFee.amount.mul(eligibleCount)
      bucket.expected = expected
      totalExpected = totalExpected.plus(expected)
    }
  }

  // Calculate PA fees: rate × pupils present today (excluding exempt)
  if (paFee && isWeekday) {
    for (const cls of classes) {
      const presentPupils = presentByClass.get(cls.id) ?? new Set()
      const bucket = byClassAndType.get(cls.id)?.get('PA')
      if (!bucket) continue

      let eligibleCount = 0
      for (const pupilId of presentPupils) {
        if (!paExemptPupils.has(pupilId)) {
          eligibleCount++
          bucket.pupilCount.add(pupilId)
          allPupilsWithCharges.add(pupilId)
        } else {
          bucket.exemptCount.add(pupilId)
        }
      }

      const expected = paFee.amount.mul(eligibleCount)
      bucket.expected = expected
      totalExpected = totalExpected.plus(expected)
    }
  }

  // Calculate TERMLY fees (keep as term-based)
  for (const charge of termCharges) {
    const feeType = charge.assignment.fee.feeType as FeeTypeKey
    if (feeType !== 'TERMLY') continue

    const classId = charge.assignment.pupil.classId
    const bucket = byClassAndType.get(classId)?.get(feeType)
    if (!bucket) continue

    bucket.expected = bucket.expected.plus(charge.amount)
    bucket.pupilCount.add(charge.assignment.pupilId)
    allPupilsWithCharges.add(charge.assignment.pupilId)
    totalExpected = totalExpected.plus(charge.amount)

    for (const alloc of charge.allocations) {
      if (alloc.payment.status === 'ACTIVE') {
        bucket.collected = bucket.collected.plus(alloc.amount)
        totalCollected = totalCollected.plus(alloc.amount)
        allPupilsWithPayments.add(charge.assignment.pupilId)
      }
    }
  }

  // Calculate OTHER (maintenance) fees (keep as term-based)
  for (const charge of termCharges) {
    const feeType = charge.assignment.fee.feeType as FeeTypeKey
    if (feeType !== 'OTHER') continue

    const classId = charge.assignment.pupil.classId
    const bucket = byClassAndType.get(classId)?.get(feeType)
    if (!bucket) continue

    bucket.expected = bucket.expected.plus(charge.amount)
    bucket.pupilCount.add(charge.assignment.pupilId)
    allPupilsWithCharges.add(charge.assignment.pupilId)
    totalExpected = totalExpected.plus(charge.amount)

    for (const alloc of charge.allocations) {
      if (alloc.payment.status === 'ACTIVE') {
        bucket.collected = bucket.collected.plus(alloc.amount)
        totalCollected = totalCollected.plus(alloc.amount)
        allPupilsWithPayments.add(charge.assignment.pupilId)
      }
    }
  }

  // Calculate DAILY collected from today's payments
  for (const payment of dayPayments) {
    for (const alloc of payment.allocations) {
      const feeType = alloc.charge?.assignment?.fee?.feeType
      if (feeType === 'DAILY' || feeType === 'PA') {
        const classId = alloc.charge?.assignment?.pupil?.classId
        if (classId) {
          const bucket = byClassAndType.get(classId)?.get(feeType as FeeTypeKey)
          if (bucket) {
            bucket.collected = bucket.collected.plus(alloc.amount)
            totalCollected = totalCollected.plus(alloc.amount)
            allPupilsWithPayments.add(alloc.charge?.assignment?.pupilId ?? payment.pupilId)
          }
        }
      }
    }
  }

  // Build per-class rows for each fee type
  function buildRows(feeType: FeeTypeKey): ClassFinanceRow[] {
    return classes
      .map((cls) => {
        const bucket = byClassAndType.get(cls.id)?.get(feeType)
        if (!bucket) return null
        const expected = bucket.expected
        const collected = bucket.collected
        const outstanding = expected.minus(collected)
        return {
          classId: cls.id,
          className: cls.name,
          pupilCount: bucket.pupilCount.size,
          expectedAmount: money(expected),
          collectedAmount: money(collected),
          outstandingAmount: money(outstanding),
        }
      })
      .filter((row): row is ClassFinanceRow => row !== null)
      .filter((row) => row.pupilCount > 0 || Number(row.expectedAmount) > 0)
  }

  const dailyFees = buildRows('DAILY')
  const ptaFees = buildRows('TERMLY')
  const maintenanceFees = buildRows('OTHER')
  const paFees = buildRows('PA')

  const totalPupils = await prisma.pupil.count({
    where: { classId: { in: classIds }, status: 'ACTIVE' },
  })

  return {
    session,
    term: { id: term.id, name: term.name },
    totals: {
      totalExpected: money(totalExpected),
      totalCollected: money(totalCollected),
      totalOutstanding: money(totalExpected.minus(totalCollected)),
      totalPupils,
      pupilsWithCharges: allPupilsWithCharges.size,
      pupilsWithPayments: allPupilsWithPayments.size,
    },
    dailyFees,
    ptaFees,
    maintenanceFees,
    paFees,
  }
}

export async function listHeadteachers(): Promise<StaffView[]> {
  const users = await prisma.user.findMany({
    where: { roles: { some: { role: { name: HEADTEACHER_ROLE } } } },
    include: headteacherInclude,
    orderBy: { createdAt: 'desc' },
  })
  return users.map(toStaffView)
}

export async function getHeadteacher(id: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id }, include: headteacherInclude })
  if (!user || !isHeadteacherUser(user)) {
    throw new AppError('Headteacher account not found.', HttpStatus.NotFound)
  }
  return toPublicUser(user)
}

/**
 * Creates a Headteacher account with a server-generated temporary password and
 * emails the invitation. Only one ACTIVE Headteacher may exist at a time
 * (replacement = deactivate the old one, then create the new one).
 *
 * The temporary password is generated entirely server-side, stored only as a
 * bcrypt hash, and delivered exclusively through the invitation email. It is
 * never written to the audit log or returned by the API. If the email fails
 * the account still exists so the Owner can retry via the resend endpoint.
 */
export async function createHeadteacher(
  actor: AuthenticatedUser,
  input: HeadteacherCreateInput,
  ip?: string,
): Promise<HeadteacherCreateResult> {
  await ensureInitialRbac()

  const activeHeadteacher = await prisma.user.findFirst({
    where: { status: 'ACTIVE', roles: { some: { role: { name: HEADTEACHER_ROLE } } } },
  })
  if (activeHeadteacher) {
    throw new AppError(
      'An active Headteacher already exists. Deactivate the current Headteacher before creating a replacement.',
      HttpStatus.Conflict,
    )
  }

  const email = input.email.toLowerCase().trim()
  await assertEmailAvailable(email)

  const role = await prisma.role.findUnique({ where: { name: HEADTEACHER_ROLE } })
  if (!role) {
    throw new AppError('Headteacher role is not configured.', HttpStatus.InternalServerError)
  }

  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashPassword(temporaryPassword)
  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.replace(/\s+/g, ' ').trim()

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName,
        email,
        phone: input.phone?.trim() || null,
        passwordHash,
        mustChangePassword: true,
        status: input.status ?? 'ACTIVE',
      },
    })
    await tx.userRole.create({ data: { userId: created.id, roleId: role.id } })
    const staffId = await nextHeadteacherStaffId()
    await tx.staffProfile.create({
      data: {
        staffId,
        userId: created.id,
        category: 'LEADERSHIP',
        address: input.address?.trim() || null,
      },
    })
    return created
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'owner.headteacher.create',
    resourceType: 'headteacher',
    resourceId: user.id,
    ip: ip ?? null,
  })

  const headteacher = await getHeadteacher(user.id)
  const invitation = await sendHeadteacherInvitation({
    to: email,
    fullName,
    staffId: headteacher.staffId ?? '—',
    temporaryPassword,
  })

  logger.info(
    {
      channel: 'mail',
      action: 'headteacher.invitation.create',
      staffId: headteacher.staffId ?? null,
      to: maskEmail(email),
      transport: invitation.transport ?? null,
      status: invitation.status,
    },
    'Invitation requested for Headteacher.',
  )

  return { headteacher, invitation }
}

/**
 * Re-sends the Headteacher invitation. A fresh temporary password is generated
 * (invalidating any previously delivered one — no duplicate account is created)
 * and the account is forced to change it on next sign-in.
 */
export async function resendHeadteacherInvitation(
  actor: AuthenticatedUser,
  id: string,
  ip?: string,
): Promise<HeadteacherCreateResult> {
  const user = await prisma.user.findUnique({ where: { id }, include: headteacherInclude })
  if (!user || !isHeadteacherUser(user)) {
    throw new AppError('Headteacher account not found.', HttpStatus.NotFound)
  }

  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashPassword(temporaryPassword)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: true },
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'owner.headteacher.invitation.resend',
    resourceType: 'headteacher',
    resourceId: id,
    ip: ip ?? null,
  })

  const updatedUser = await prisma.user.findUnique({ where: { id }, include: headteacherInclude })
  if (!updatedUser) {
    throw new AppError('Headteacher account not found.', HttpStatus.NotFound)
  }
  const headteacher = toPublicUser(updatedUser)
  const invitation = await sendHeadteacherInvitation({
    to: user.email,
    fullName: user.fullName,
    staffId: user.staffProfile?.staffId ?? '—',
    temporaryPassword,
  })

  logger.info(
    {
      channel: 'mail',
      action: 'headteacher.invitation.resend',
      staffId: user.staffProfile?.staffId ?? null,
      to: maskEmail(user.email),
      transport: invitation.transport ?? null,
      status: invitation.status,
    },
    'Invitation requested for Headteacher.',
  )

  return { headteacher, invitation }
}

export async function updateHeadteacher(
  actor: AuthenticatedUser,
  id: string,
  input: HeadteacherUpdateInput,
  ip?: string,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id }, include: headteacherInclude })
  if (!user || !isHeadteacherUser(user)) {
    throw new AppError('Headteacher account not found.', HttpStatus.NotFound)
  }

  const data: Record<string, unknown> = {}
  if (input.firstName || input.lastName) {
    const firstName = input.firstName?.trim() ?? ''
    const lastName = input.lastName?.trim() ?? ''
    data.fullName = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim()
  }
  if (input.email) {
    await assertEmailAvailable(input.email, user.id)
    data.email = input.email.toLowerCase().trim()
  }
  if (input.phone !== undefined) data.phone = input.phone?.trim() || null
  if (input.address !== undefined) {
    await prisma.staffProfile.update({
      where: { userId: user.id },
      data: { address: input.address?.trim() || null },
    })
  }

  await prisma.user.update({ where: { id: user.id }, data })
  await recordAudit({
    actorUserId: actor.id,
    action: 'owner.headteacher.update',
    resourceType: 'headteacher',
    resourceId: id,
    ip: ip ?? null,
  })

  return getHeadteacher(id)
}

export async function setHeadteacherStatus(
  actor: AuthenticatedUser,
  id: string,
  status: 'ACTIVE' | 'INACTIVE',
  ip?: string,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id }, include: headteacherInclude })
  if (!user || !isHeadteacherUser(user)) {
    throw new AppError('Headteacher account not found.', HttpStatus.NotFound)
  }

  if (status === 'ACTIVE') {
    const otherActive = await prisma.user.findFirst({
      where: {
        id: { not: id },
        status: 'ACTIVE',
        roles: { some: { role: { name: HEADTEACHER_ROLE } } },
      },
    })
    if (otherActive) {
      throw new AppError(
        'Another Headteacher is already active. Deactivate them before activating this account.',
        HttpStatus.Conflict,
      )
    }
  }

  await prisma.user.update({ where: { id }, data: { status } })
  await recordAudit({
    actorUserId: actor.id,
    action: status === 'ACTIVE' ? 'owner.headteacher.activate' : 'owner.headteacher.deactivate',
    resourceType: 'headteacher',
    resourceId: id,
    ip: ip ?? null,
  })

  return getHeadteacher(id)
}

/**
 * Replaces the Headteacher role's permission set. Owner-only keys can never be
 * granted — enforcing rule: the Headteacher can never hold owner authority.
 */
export async function setHeadteacherPermissions(
  actor: AuthenticatedUser,
  id: string,
  permissionKeys: string[],
  ip?: string,
): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id }, include: headteacherInclude })
  if (!user || !isHeadteacherUser(user)) {
    throw new AppError('Headteacher account not found.', HttpStatus.NotFound)
  }

  const headteacherRole = user.roles.find(({ role }) => role.name === HEADTEACHER_ROLE)
  if (!headteacherRole) {
    throw new AppError('Headteacher role assignment is missing.', HttpStatus.InternalServerError)
  }

  const validCatalog = new Set(PERMISSIONS.map((permission) => permission.key))
  const sanitized = Array.from(
    new Set(
      permissionKeys.filter(
        (key) =>
          validCatalog.has(key) &&
          !(OWNER_ONLY_PERMISSIONS as readonly string[]).includes(key),
      ),
    ),
  )

  await prisma.$transaction([
    prisma.rolePermission.deleteMany({ where: { roleId: headteacherRole.role.id } }),
    ...sanitized.map((key) =>
      prisma.rolePermission.create({
        data: {
          role: { connect: { id: headteacherRole.role.id } },
          permission: { connect: { key } },
        },
      }),
    ),
  ])

  await recordAudit({
    actorUserId: actor.id,
    action: 'owner.headteacher.permissions.update',
    resourceType: 'headteacher',
    resourceId: id,
    metadata: { permissions: sanitized },
    ip: ip ?? null,
  })

  return getHeadteacher(id)
}