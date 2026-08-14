import { HEADTEACHER_ROLE, OWNER_ONLY_PERMISSIONS, PERMISSIONS } from '../rbac/catalog'
import { HttpStatus } from '../config/enums'
import { hashPassword } from '../lib/password'
import { prisma } from '../lib/prisma'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import { ensureInitialRbac } from './ensure-rbac'
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
  password: string
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface HeadteacherUpdateInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
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
  totals: { staff: number; pupils: number; classes: number; admissions: number; auditEntries: number }
}> {
  const [headteacher, staffCount, auditEntries] = await Promise.all([
    prisma.user.findFirst({
      where: { roles: { some: { role: { name: HEADTEACHER_ROLE } } } },
      include: headteacherInclude,
    }),
    prisma.staffProfile.count({
      where: { category: { in: ['TEACHING', 'NON_TEACHING'] } },
    }),
    prisma.auditLog.count(),
  ])

  return {
    headteacher: headteacher ? toPublicUser(headteacher) : null,
    totals: {
      staff: staffCount,
      // Later phases (4, 3, 4) own these counts.
      pupils: 0,
      classes: 0,
      admissions: 0,
      auditEntries,
    },
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
 * Creates a Headteacher account. Only one ACTIVE Headteacher may exist at a
 * time (replacement = deactivate the old one, then create the new one).
 */
export async function createHeadteacher(
  actor: AuthenticatedUser,
  input: HeadteacherCreateInput,
  ip?: string,
): Promise<PublicUser> {
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

  const passwordHash = await hashPassword(input.password)
  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.replace(/\s+/g, ' ').trim()

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName,
        email,
        phone: input.phone?.trim() || null,
        passwordHash,
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

  return getHeadteacher(user.id)
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