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
    headteachers: number
    pupils: number
    classes: number
    admissions: number
    auditEntries: number
  }
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
  const [headteacher, staffCount, teachingCount, nonTeachingCount, headteacherCount, auditEntries, staffActivity, permissionChanges] =
    await Promise.all([
      prisma.user.findFirst({
        where: { roles: { some: { role: { name: HEADTEACHER_ROLE } } } },
        include: headteacherInclude,
      }),
      prisma.staffProfile.count({ where: { category: { in: ['TEACHING', 'NON_TEACHING'] } } }),
      prisma.staffProfile.count({ where: { category: 'TEACHING' } }),
      prisma.staffProfile.count({ where: { category: 'NON_TEACHING' } }),
      prisma.user.count({ where: { roles: { some: { role: { name: HEADTEACHER_ROLE } } } } }),
      prisma.auditLog.count(),
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

  return {
    headteacher: headteacher ? toPublicUser(headteacher) : null,
    totals: {
      staff: staffCount,
      teaching: teachingCount,
      nonTeaching: nonTeachingCount,
      headteachers: headteacherCount,
      // Later phases (4, 3, 4) own these counts.
      pupils: 0,
      classes: 0,
      admissions: 0,
      auditEntries,
    },
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