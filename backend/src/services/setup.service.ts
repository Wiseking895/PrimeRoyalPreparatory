import { randomBytes } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import { OWNER_ROLE } from '../rbac/catalog.js'
import { HttpStatus } from '../config/enums.js'
import { hashPassword } from '../lib/password.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../utils/app-error.js'
import { recordAudit } from './audit.service.js'
import { DEVELOPER_EMAIL } from './developer.service.js'
import { ensureInitialRbac } from './ensure-rbac.js'
import type { GoogleProfile } from './google-oauth.service.js'
import { toPublicUser, type PublicUser } from './user-mapper.js'

/**
 * Postgres advisory-lock key for the first-Owner flow (ASCII "PRPS").
 *
 * `ownerExists()` alone has a TOCTOU window: two simultaneous requests can both
 * observe "no Owner yet" and both insert one, permanently closing the setup
 * flow with a duplicate. The lock is transaction-scoped
 * (`pg_advisory_xact_lock`), so it is held from the first statement until the
 * transaction commits or rolls back, which makes the check-and-create sequence
 * a single critical section across all concurrent requests. No table, index or
 * schema change is required.
 */
const OWNER_SETUP_LOCK_ID = 0x50525053

/**
 * The single source of truth for "has the school created its own Owner yet".
 *
 * The permanent developer/maintenance account also holds the OWNER role, but it
 * must never satisfy this check: otherwise provisioning it would permanently
 * close the first-Owner flow (POST /api/setup/owner) and the school could never
 * create its operational Owner. Only a non-developer Owner completes setup.
 *
 * Built lazily so the developer e-mail constant is read at call time rather
 * than at module import time.
 */
function ownerExistsWhere(): Prisma.UserWhereInput {
  return {
    roles: { some: { role: { name: OWNER_ROLE } } },
    email: { not: DEVELOPER_EMAIL },
  }
}

export function ownerExists(): Promise<boolean> {
  return prisma.user.findFirst({ where: ownerExistsWhere() }).then((user) => user !== null)
}

export interface OwnerSetupInput {
  fullName: string
  email: string
  phone?: string
  password: string
}

interface ProvisionOwnerInput {
  fullName: string
  email: string
  phone: string | null
  /** Cleartext password; hashed here, inside the locked transaction. */
  password: string
  auditAction: string
  auditMetadata?: Prisma.InputJsonValue
}

/**
 * Creates the school's first operational Owner account.
 *
 * Everything that decides whether setup is still allowed — the lock, the
 * owner-exists check, the duplicate-e-mail check — happens inside ONE
 * transaction that holds the advisory lock, so no interleaving of concurrent
 * requests can produce two Owners. Only reachable while NO school Owner exists;
 * enforced here in the backend, never trusted to the frontend. The permanent
 * developer account never blocks this flow and is never created here.
 */
async function provisionOwner(input: ProvisionOwnerInput, ip?: string): Promise<PublicUser> {
  const owner = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(CAST(${String(
      OWNER_SETUP_LOCK_ID,
    )} AS bigint))) AS taken`

    const currentOwner = await tx.user.findFirst({ where: ownerExistsWhere() })
    if (currentOwner) {
      throw new AppError('Initial owner setup has already been completed.', HttpStatus.Conflict)
    }

    const email = input.email.toLowerCase().trim()
    const existing = await tx.user.findUnique({ where: { email } })
    if (existing) {
      throw new AppError('An account with this email already exists.', HttpStatus.Conflict)
    }

    const role = await tx.role.findUnique({ where: { name: OWNER_ROLE } })
    if (!role) {
      throw new AppError('Owner role is not configured.', HttpStatus.InternalServerError)
    }

    const passwordHash = await hashPassword(input.password)

    const user = await tx.user.create({
      data: {
        fullName: input.fullName.trim(),
        email,
        phone: input.phone,
        passwordHash,
      },
    })
    await tx.userRole.create({ data: { userId: user.id, roleId: role.id } })
    return user
  })

  await recordAudit({
    actorUserId: owner.id,
    action: input.auditAction,
    resourceType: 'user',
    resourceId: owner.id,
    metadata: input.auditMetadata,
    ip: ip ?? null,
  })

  return toPublicUser({
    ...owner,
    staffProfile: null,
    roles: [{ role: { name: OWNER_ROLE, rolePermissions: [] } }],
  })
}

/**
 * Creates the school's first operational Owner account from the email/password
 * sign-up form on `/setup/owner`.
 */
export async function createOwner(input: OwnerSetupInput, ip?: string): Promise<PublicUser> {
  await ensureInitialRbac()

  return provisionOwner(
    {
      fullName: input.fullName,
      email: input.email,
      phone: input.phone?.trim() || null,
      password: input.password,
      auditAction: 'owner.initial_setup',
    },
    ip,
  )
}

/**
 * Creates the school's first operational Owner account from a verified Google
 * identity.
 *
 * The account gets a random, never-disclosed password hash rather than a real
 * credential: `User.passwordHash` is NOT NULL in the schema, so this keeps the
 * column satisfied and requires **no migration**, while in practice the Owner
 * can only ever authenticate through Google. Nothing about the dedicated
 * Developer account is touched — it is neither created nor counted here.
 */
export async function createOwnerFromGoogle(profile: GoogleProfile, ip?: string): Promise<PublicUser> {
  await ensureInitialRbac()

  return provisionOwner(
    {
      fullName: profile.fullName,
      email: profile.email,
      phone: null,
      password: randomBytes(32).toString('hex'),
      auditAction: 'owner.initial_setup_google',
      auditMetadata: { provider: 'google', googleId: profile.googleId },
    },
    ip,
  )
}
