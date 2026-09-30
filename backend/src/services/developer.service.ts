import { HttpStatus } from '../config/enums.js'
import { prisma } from '../lib/prisma.js'
import { AppError } from '../utils/app-error.js'
import { recordAudit } from './audit.service.js'

/**
 * The permanent PRPS developer / maintenance account.
 *
 * This is a SYSTEM FIXTURE, not trial or demo data: it is how the application
 * owner maintains and updates PRPS without borrowing school staff credentials.
 * Production-baseline cleanups must preserve it. It is provisioned only
 * through `scripts/developer-bootstrap.ts` — never by the database seed,
 * never by application startup, and never by the `/api/setup/owner` flow.
 */
export const DEVELOPER_EMAIL = 'developer@prps.local'
const DEVELOPER_STAFF_POSITION = 'DEVELOPER'

/**
 * Single source of truth for "this email belongs to the permanent developer
 * account". Cleanup/maintenance code must use this instead of comparing the
 * literal, so the account can never be misclassified as disposable data.
 */
export function isPermanentDeveloperEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === DEVELOPER_EMAIL
}

/**
 * Checks whether the given user is the dedicated PRPS developer account.
 * Identified by the well-known email address AND the DEVELOPER staff position.
 * This prevents ordinary Owner accounts from gaining impersonation privileges.
 */
export async function isDeveloperAccount(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { staffProfile: true },
  })
  if (!user) return false
  return isPermanentDeveloperEmail(user.email) && user.staffProfile?.position === DEVELOPER_STAFF_POSITION
}

export interface DeveloperAccount {
  id: string
  fullName: string
  email: string
  phone: string | null
  profilePictureUrl: string | null
  staffId: string | null
  category: string | null
  position: string | null
  roles: string[]
}

/**
 * Returns all active user accounts that are eligible for developer impersonation.
 * Excludes the developer account itself. Never exposes password hashes or secrets.
 */
export async function listImpersonatableAccounts(): Promise<DeveloperAccount[]> {
  const users = await prisma.user.findMany({
    where: {
      status: 'ACTIVE',
      email: { not: DEVELOPER_EMAIL },
    },
    include: {
      staffProfile: true,
      roles: { include: { role: true } },
    },
    orderBy: { fullName: 'asc' },
  })

  return users.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    profilePictureUrl: user.profilePictureUrl,
    staffId: user.staffProfile?.staffId ?? null,
    category: user.staffProfile?.category ?? null,
    position: user.staffProfile?.position ?? null,
    roles: user.roles.map(({ role }) => role.name),
  }))
}

/**
 * Validates that a target user exists, is active, and is eligible for impersonation.
 * Returns the full user record (with roles and permissions) for the acting context.
 */
export async function validateImpersonationTarget(targetUserId: string) {
  const target = await prisma.user.findUnique({
    where: { id: targetUserId },
    include: {
      staffProfile: true,
      roles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
    },
  })

  if (!target) {
    throw new AppError('Account not found.', HttpStatus.NotFound)
  }

  if (target.status !== 'ACTIVE') {
    throw new AppError('This account is not active and cannot be impersonated.', HttpStatus.BadRequest)
  }

  if (isPermanentDeveloperEmail(target.email)) {
    throw new AppError('Cannot impersonate the developer account.', HttpStatus.BadRequest)
  }

  return target
}

export async function recordImpersonationStart(
  developerId: string,
  targetUserId: string,
  ip?: string,
): Promise<void> {
  await recordAudit({
    actorUserId: developerId,
    action: 'developer.impersonation.started',
    resourceType: 'user',
    resourceId: targetUserId,
    metadata: { targetUserId },
    ip: ip ?? null,
  })
}

export async function recordImpersonationEnd(
  developerId: string,
  targetUserId: string,
  ip?: string,
): Promise<void> {
  await recordAudit({
    actorUserId: developerId,
    action: 'developer.impersonation.ended',
    resourceType: 'user',
    resourceId: targetUserId,
    metadata: { targetUserId },
    ip: ip ?? null,
  })
}

export async function recordImpersonationSwitch(
  developerId: string,
  fromUserId: string,
  toUserId: string,
  ip?: string,
): Promise<void> {
  await recordAudit({
    actorUserId: developerId,
    action: 'developer.impersonation.switched',
    resourceType: 'user',
    resourceId: toUserId,
    metadata: { fromUserId, toUserId },
    ip: ip ?? null,
  })
}
