import { OWNER_ROLE } from '@prps/shared'
import { HttpStatus } from '@prps/shared'
import { hashPassword } from '../lib/password'
import { prisma } from '../lib/prisma'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import { ensureInitialRbac } from './ensure-rbac'
import { toPublicUser, type PublicUser } from './user-mapper'

export function ownerExists(): Promise<boolean> {
  return prisma.user
    .findFirst({ where: { roles: { some: { role: { name: OWNER_ROLE } } } } })
    .then((user) => user !== null)
}

export interface OwnerSetupInput {
  fullName: string
  email: string
  phone?: string
  password: string
}

/**
 * Creates the first Owner account. Only reachable while NO Owner exists —
 * enforced here in the backend, never trusted to the frontend.
 */
export async function createOwner(input: OwnerSetupInput, ip?: string): Promise<PublicUser> {
  await ensureInitialRbac()

  if (await ownerExists()) {
    throw new AppError('Initial owner setup has already been completed.', HttpStatus.Conflict)
  }

  const email = input.email.toLowerCase().trim()
  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    throw new AppError('An account with this email already exists.', HttpStatus.Conflict)
  }

  const role = await prisma.role.findUnique({ where: { name: OWNER_ROLE } })
  if (!role) {
    throw new AppError('Owner role is not configured.', HttpStatus.InternalServerError)
  }

  const passwordHash = await hashPassword(input.password)

  const owner = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        fullName: input.fullName.trim(),
        email,
        phone: input.phone?.trim() || null,
        passwordHash,
      },
    })
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } })
    return user
  })

  await recordAudit({
    actorUserId: owner.id,
    action: 'owner.initial_setup',
    resourceType: 'user',
    resourceId: owner.id,
    ip: ip ?? null,
  })

  return toPublicUser({
    ...owner,
    staffProfile: null,
    roles: [{ role: { name: OWNER_ROLE, rolePermissions: [] } }],
  })
}