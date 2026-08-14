import { HttpStatus } from '../config/enums'
import { STAFF_CATEGORIES } from '../rbac/catalog'
import { hashPassword } from '../lib/password'
import { prisma } from '../lib/prisma'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import { assertNoEscalation, assertRoleAssignable, isOwner } from './rbac-guards'
import { toStaffView, type StaffView } from './user-mapper'

const staffInclude = {
  staffProfile: true,
  roles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
} as const

const DEFAULT_STAFF_ROLE = 'NON_TEACHING_STAFF'

const TEACHING_ROLES = new Set(['CLASS_TEACHER', 'SUBJECT_TEACHER'])

export interface StaffCreateInput {
  firstName: string
  lastName: string
  email: string
  phone?: string
  password: string
  roleName?: string
  category?: 'TEACHING' | 'NON_TEACHING'
  address?: string
}

export interface StaffUpdateInput {
  firstName?: string
  lastName?: string
  email?: string
  phone?: string
  address?: string
  category?: 'TEACHING' | 'NON_TEACHING'
  responsibilities?: string
}

async function nextStaffId(): Promise<string> {
  const count = await prisma.staffProfile.count({ where: { staffId: { startsWith: 'PRPS-STF-' } } })
  return `PRPS-STF-${String(count + 1).padStart(4, '0')}`
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

function categoryForRole(roleName: string, requested?: string): string {
  if (requested) return requested
  return TEACHING_ROLES.has(roleName) ? STAFF_CATEGORIES.TEACHING : STAFF_CATEGORIES.NON_TEACHING
}

export async function listStaff(search?: string): Promise<StaffView[]> {
  const users = await prisma.user.findMany({
    where: {
      staffProfile: { isNot: null },
      ...(search
        ? {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { staffProfile: { is: { staffId: { contains: search, mode: 'insensitive' } } } },
            ],
          }
        : {}),
    },
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
 * Creates a staff account with an assigned role. The role must be assignable
 * (never Owner/Headteacher) and its permission set must not exceed the
 * creator's own authority.
 */
export async function createStaff(
  actor: AuthenticatedUser,
  input: StaffCreateInput,
  ip?: string,
): Promise<StaffView> {
  const roleName = input.roleName?.trim() || DEFAULT_STAFF_ROLE
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

  const passwordHash = await hashPassword(input.password)
  const fullName = `${input.firstName.trim()} ${input.lastName.trim()}`.replace(/\s+/g, ' ').trim()

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        fullName,
        email,
        phone: input.phone?.trim() || null,
        passwordHash,
      },
    })
    await tx.userRole.create({ data: { userId: created.id, roleId: role.id } })
    const staffId = await nextStaffId()
    await tx.staffProfile.create({
      data: {
        staffId,
        userId: created.id,
        category: categoryForRole(roleName, input.category),
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
    metadata: { role: roleName },
    ip: ip ?? null,
  })

  return getStaff(user.id)
}

export async function updateStaff(
  actor: AuthenticatedUser,
  id: string,
  input: StaffUpdateInput,
  ip?: string,
): Promise<StaffView> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: { staffProfile: true, roles: true },
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
  if (input.category !== undefined) profileData.category = input.category
  if (input.responsibilities !== undefined) profileData.responsibilities = input.responsibilities?.trim() || null

  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: userData }),
    prisma.staffProfile.update({ where: { userId: id }, data: profileData }),
  ])
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