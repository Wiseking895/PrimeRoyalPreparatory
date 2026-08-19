import type { Prisma } from '@prisma/client'
import { HttpStatus } from '../config/enums'
import { logger } from '../config/logger'
import { HEADTEACHER_ROLE, OWNER_ROLE, STAFF_CATEGORIES, staffPositionByKey } from '../rbac/catalog'
import { hashPassword } from '../lib/password'
import { generateTemporaryPassword } from '../lib/temporary-password'
import { prisma } from '../lib/prisma'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import { assertNoEscalation, assertRoleAssignable, isOwner } from './rbac-guards'
import { maskEmail, sendStaffInvitation, type MailResult } from './mail.service'
import { toStaffView, type StaffView } from './user-mapper'

const staffInclude = {
  staffProfile: true,
  roles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
} as const

const DEFAULT_STAFF_ROLE = 'NON_TEACHING_STAFF'

export interface StaffCreateInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  address?: string
  position: string
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface StaffUpdateInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  category?: 'TEACHING' | 'NON_TEACHING'
  position?: string
  responsibilities?: string
}

export interface StaffListOptions {
  q?: string
  category?: string
  position?: string
  status?: 'ACTIVE' | 'INACTIVE'
}

export type InvitationResult = MailResult

export interface StaffCreateResult {
  staff: StaffView
  invitation: InvitationResult
}

export interface StaffStats {
  total: number
  teaching: number
  nonTeaching: number
  active: number
  inactive: number
  byPosition: Record<string, number>
  recentActivity: Array<{
    id: string
    action: string
    createdAt: Date
    actor: { id: string; fullName: string; email: string } | null
  }>
}

/** Staff managed by the Headteacher/Owner: teaching + non-teaching (never the Owner/Headteacher themselves). */
const manageableStaffFilter = {
  roles: { none: { role: { name: { in: [OWNER_ROLE, HEADTEACHER_ROLE] } } } },
}

async function nextStaffId(): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const count = await prisma.staffProfile.count({ where: { staffId: { startsWith: 'PRPS-STF-' } } })
    const candidate = `PRPS-STF-${String(count + attempt + 1).padStart(4, '0')}`
    const existing = await prisma.staffProfile.findUnique({ where: { staffId: candidate } })
    if (!existing) return candidate
  }
  throw new AppError('Could not generate a unique staff ID.', HttpStatus.Conflict)
}

async function resolveRolePermissions(roleName: string): Promise<string[]> {
  const role = await prisma.role.findUnique({
    where: { name: roleName },
    include: { rolePermissions: { include: { permission: true } } },
  })
  return role?.rolePermissions.map(({ permission }) => permission.key) ?? []
}

async function assertEmailAvailable(email: string, excludeUserId?: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
  if (existing && existing.id !== excludeUserId) {
    throw new AppError('An account with this email already exists.', HttpStatus.Conflict)
  }
}

function assertValidPosition(position: string): void {
  if (!staffPositionByKey(position)) {
    throw new AppError('Please select a valid staff position.', HttpStatus.BadRequest)
  }
}

function positionLabel(position: string | null | undefined): string {
  return staffPositionByKey(position)?.label ?? 'Staff'
}

export async function listStaff(options: StaffListOptions = {}): Promise<StaffView[]> {
  const { q, category, position, status } = options

  const profileFilter: Prisma.StaffProfileWhereInput = {}
  if (category) profileFilter.category = category
  if (position) profileFilter.position = position

  const where: Prisma.UserWhereInput = {
    ...manageableStaffFilter,
    staffProfile: Object.keys(profileFilter).length > 0 ? { is: profileFilter } : { isNot: null },
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { fullName: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
            { staffProfile: { is: { staffId: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  }

  const users = await prisma.user.findMany({
    where,
    include: staffInclude,
    orderBy: { createdAt: 'desc' },
  })
  return users.map(toStaffView)
}

export async function getStaff(id: string): Promise<StaffView> {
  const user = await prisma.user.findUnique({ where: { id }, include: staffInclude })
  if (!user || !user.staffProfile) {
    throw new AppError('Staff account not found.', HttpStatus.NotFound)
  }
  return toStaffView(user)
}

/**
 * Creates a staff account with an invitation flow: the role and category are
 * derived from the chosen position, a server-generated temporary password is
 * stored only as a bcrypt hash, and the account is forced to change it on first
 * sign-in. The temporary password is delivered exclusively through the
 * invitation email and is never written to the audit log or returned by the API.
 */
export async function createStaff(
  actor: AuthenticatedUser,
  input: StaffCreateInput,
  ip?: string,
): Promise<StaffCreateResult> {
  const definition = staffPositionByKey(input.position?.trim())
  if (!definition) {
    throw new AppError('Please select a valid staff position.', HttpStatus.BadRequest)
  }
  const roleName = definition.role
  assertRoleAssignable(roleName)
  if (!isOwner(actor) && roleName !== DEFAULT_STAFF_ROLE && !actor.permissionKeys.includes('staff.assign_role')) {
    throw new AppError('Forbidden: you do not have permission to assign staff roles.', HttpStatus.Forbidden)
  }
  assertNoEscalation(actor, await resolveRolePermissions(roleName))

  const email = input.email.toLowerCase().trim()
  await assertEmailAvailable(email)

  const role = await prisma.role.findUnique({ where: { name: roleName } })
  if (!role) {
    throw new AppError('The assigned role is not configured.', HttpStatus.InternalServerError)
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
    const staffId = await nextStaffId()
    await tx.staffProfile.create({
      data: {
        staffId,
        userId: created.id,
        category: definition.category,
        position: definition.key,
        address: input.address?.trim() || null,
      },
    })
    return created
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'staff.create',
    resourceType: 'staff',
    resourceId: user.id,
    metadata: { role: roleName, position: definition.key },
    ip: ip ?? null,
  })

  const staff = await getStaff(user.id)
  const invitation = await sendStaffInvitation({
    to: email,
    fullName,
    staffId: staff.staffId ?? '—',
    temporaryPassword,
    position: definition.label,
  })

  logger.info(
    {
      channel: 'mail',
      action: 'staff.invitation.create',
      staffId: staff.staffId ?? null,
      to: maskEmail(email),
      transport: invitation.transport ?? null,
      status: invitation.status,
    },
    'Invitation requested for staff member.',
  )

  return { staff, invitation }
}

export async function updateStaff(
  actor: AuthenticatedUser,
  id: string,
  input: StaffUpdateInput,
  ip?: string,
): Promise<StaffView> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { staffProfile: true, roles: { include: { role: true } } },
  })
  if (!user || !user.staffProfile) {
    throw new AppError('Staff account not found.', HttpStatus.NotFound)
  }

  const userData: Record<string, unknown> = {}
  if (input.firstName || input.lastName) {
    const firstName = input.firstName?.trim() ?? ''
    const lastName = input.lastName?.trim() ?? ''
    userData.fullName = `${firstName} ${lastName}`.replace(/\s+/g, ' ').trim()
  }
  if (input.email) {
    await assertEmailAvailable(input.email, user.id)
    userData.email = input.email.toLowerCase().trim()
  }
  if (input.phone !== undefined) userData.phone = input.phone?.trim() || null

  const profileData: Record<string, unknown> = {}
  if (input.address !== undefined) profileData.address = input.address?.trim() || null
  if (input.category !== undefined && input.position === undefined) profileData.category = input.category
  if (input.responsibilities !== undefined) profileData.responsibilities = input.responsibilities?.trim() || null

  let roleReassignment: { deleteMany: Prisma.PrismaPromise<unknown>; create: Prisma.PrismaPromise<unknown> } | undefined
  if (input.position !== undefined) {
    assertValidPosition(input.position)
    const definition = staffPositionByKey(input.position)!
    profileData.position = definition.key
    profileData.category = definition.category

    const currentRoleName = user.roles[0]?.role?.name
    if (currentRoleName !== definition.role) {
      assertRoleAssignable(definition.role)
      assertNoEscalation(actor, await resolveRolePermissions(definition.role))
      const role = await prisma.role.findUnique({ where: { name: definition.role } })
      if (!role) {
        throw new AppError('The assigned role is not configured.', HttpStatus.InternalServerError)
      }
      roleReassignment = {
        deleteMany: prisma.userRole.deleteMany({ where: { userId: id } }),
        create: prisma.userRole.create({ data: { userId: id, roleId: role.id } }),
      }
    }
  }

  const operations: Prisma.PrismaPromise<unknown>[] = [
    prisma.user.update({ where: { id }, data: userData }),
    prisma.staffProfile.update({ where: { userId: id }, data: profileData }),
  ]
  if (roleReassignment) {
    operations.push(roleReassignment.deleteMany, roleReassignment.create)
  }
  await prisma.$transaction(operations)

  await recordAudit({
    actorUserId: actor.id,
    action: 'staff.update',
    resourceType: 'staff',
    resourceId: id,
    ip: ip ?? null,
  })

  return getStaff(id)
}

export async function setStaffStatus(
  actor: AuthenticatedUser,
  id: string,
  status: 'ACTIVE' | 'INACTIVE',
  ip?: string,
): Promise<StaffView> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { staffProfile: true },
  })
  if (!user || !user.staffProfile) {
    throw new AppError('Staff account not found.', HttpStatus.NotFound)
  }
  if (id === actor.id) {
    throw new AppError('You cannot deactivate your own account.', HttpStatus.BadRequest)
  }

  await prisma.user.update({ where: { id }, data: { status } })
  await recordAudit({
    actorUserId: actor.id,
    action: status === 'ACTIVE' ? 'staff.activate' : 'staff.deactivate',
    resourceType: 'staff',
    resourceId: id,
    ip: ip ?? null,
  })

  return getStaff(id)
}

/**
 * Re-sends a staff invitation. A fresh temporary password is generated
 * (invalidating any previously delivered one — no duplicate account is created)
 * and the account is forced to change it on next sign-in.
 */
export async function resendStaffInvitation(
  actor: AuthenticatedUser,
  id: string,
  ip?: string,
): Promise<StaffCreateResult> {
  const user = await prisma.user.findUnique({ where: { id }, include: staffInclude })
  if (!user || !user.staffProfile) {
    throw new AppError('Staff account not found.', HttpStatus.NotFound)
  }

  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashPassword(temporaryPassword)
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: true },
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'staff.invitation.resend',
    resourceType: 'staff',
    resourceId: id,
    ip: ip ?? null,
  })

  const staff = await getStaff(id)
  const invitation = await sendStaffInvitation({
    to: user.email,
    fullName: user.fullName,
    staffId: user.staffProfile.staffId,
    temporaryPassword,
    position: positionLabel(user.staffProfile.position),
  })

  logger.info(
    {
      channel: 'mail',
      action: 'staff.invitation.resend',
      staffId: user.staffProfile.staffId,
      to: maskEmail(user.email),
      transport: invitation.transport ?? null,
      status: invitation.status,
    },
    'Invitation requested for staff member.',
  )

  return { staff, invitation }
}

/**
 * Aggregate staff statistics over the teaching + non-teaching staff currently
 * managed, including recent staff activity for the dashboard overview.
 */
export async function getStaffStats(): Promise<StaffStats> {
  const [users, activity] = await Promise.all([
    prisma.user.findMany({
      where: {
        ...manageableStaffFilter,
        staffProfile: { isNot: null },
      },
      select: {
        id: true,
        status: true,
        staffProfile: { select: { category: true, position: true } },
      },
    }),
    prisma.auditLog.findMany({
      where: { action: { startsWith: 'staff.' } },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { actorUser: { select: { id: true, fullName: true, email: true } } },
    }),
  ])

  const byPosition: Record<string, number> = {}
  let teaching = 0
  let nonTeaching = 0
  let active = 0
  let inactive = 0

  for (const user of users) {
    const category = user.staffProfile?.category
    if (category === STAFF_CATEGORIES.TEACHING) teaching += 1
    else if (category === STAFF_CATEGORIES.NON_TEACHING) nonTeaching += 1
    if (user.status === 'ACTIVE') active += 1
    else inactive += 1

    const position = user.staffProfile?.position ?? 'UNKNOWN'
    byPosition[position] = (byPosition[position] ?? 0) + 1
  }

  return {
    total: users.length,
    teaching,
    nonTeaching,
    active,
    inactive,
    byPosition,
    recentActivity: activity.map((entry) => ({
      id: entry.id,
      action: entry.action,
      createdAt: entry.createdAt,
      actor: entry.actorUser,
    })),
  }
}

export async function assignRole(
  actor: AuthenticatedUser,
  id: string,
  roleName: string,
  ip?: string,
): Promise<StaffView> {
  assertRoleAssignable(roleName)
  assertNoEscalation(actor, await resolveRolePermissions(roleName))

  const user = await prisma.user.findUnique({ where: { id }, include: { staffProfile: true, roles: true } })
  if (!user || !user.staffProfile) {
    throw new AppError('Staff account not found.', HttpStatus.NotFound)
  }

  const role = await prisma.role.findUnique({ where: { name: roleName } })
  if (!role) {
    throw new AppError('The assigned role is not configured.', HttpStatus.InternalServerError)
  }

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: id } }),
    prisma.userRole.create({ data: { userId: id, roleId: role.id } }),
  ])
  await recordAudit({
    actorUserId: actor.id,
    action: 'staff.assign_role',
    resourceType: 'staff',
    resourceId: id,
    metadata: { role: roleName },
    ip: ip ?? null,
  })

  return getStaff(id)
}

export async function removeRole(actor: AuthenticatedUser, id: string, ip?: string): Promise<StaffView> {
  const user = await prisma.user.findUnique({ where: { id }, include: { staffProfile: true } })
  if (!user || !user.staffProfile) {
    throw new AppError('Staff account not found.', HttpStatus.NotFound)
  }

  await prisma.userRole.deleteMany({ where: { userId: id } })
  await recordAudit({
    actorUserId: actor.id,
    action: 'staff.remove_role',
    resourceType: 'staff',
    resourceId: id,
    ip: ip ?? null,
  })

  return getStaff(id)
}