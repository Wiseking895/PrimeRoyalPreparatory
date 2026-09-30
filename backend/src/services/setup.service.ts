import { OWNER_ROLE } from '../rbac/catalog.js'
import { HttpStatus } from '../config/enums.js'
import { hashPassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../utils/app-error.js'
import { recordAudit } from './audit.service.js'
import { DEVELOPER_EMAIL } from './developer.service.js'
import { ensureInitialRbac } from './ensure-rbac.js'
import { toPublicUser, type PublicUser } from './user-mapper.js'

/**
 * True when the school's OWN Owner exists.
 *
 * The permanent developer/maintenance account also holds the OWNER role, but it
 * must never satisfy this check: otherwise provisioning it would permanently
 * close the first-Owner flow (POST /api/setup/owner) and the school could never
 * create its operational Owner. Only a non-developer Owner completes setup.
 */
export function ownerExists(): Promise<boolean> {
  return prisma.user
    .findFirst({
      where: {
        roles: { some: { role: { name: OWNER_ROLE } } },
        email: { not: DEVELOPER_EMAIL },
      },
    })
    .then((user) => user !== null)
}

export interface OwnerSetupInput {
  fullName: string
  email: string
  phone?: string
  password: string
}

/**
 * Creates the school's first operational Owner account. Only reachable while
 * NO school Owner exists — enforced here in the backend, never trusted to the
 * frontend. The permanent developer account never blocks this flow and is
 * never created here.
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