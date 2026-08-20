import { HttpStatus } from '../config/enums'
import { signToken } from '../lib/jwt'
import { hashPassword, verifyPassword } from '../lib/password'
import { prisma } from '../lib/prisma'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import { toParentProfile, type ParentProfileView } from './guardian-mapper'

/**
 * Phase 7 Parent Portal authentication.
 *
 * Parents are Guardians that the school has provisioned with an account
 * (`passwordHash` set + `status` ACTIVE). Their login identifier is the
 * `accountEmail` assigned at provisioning time. Everything else mirrors the
 * staff auth flow: bcrypt password verification, per-request database
 * resolution, first-login password change and audit logging. Temporary
 * passwords are never returned by the API — they are delivered only through
 * the invitation email (or the development console transport).
 */

export interface ParentLoginResult {
  token: string
  user: ParentProfileView
}

export async function parentLogin(
  identifier: string,
  password: string,
  ip?: string,
): Promise<ParentLoginResult> {
  const normalized = identifier.trim().toLowerCase()
  const guardian = await prisma.guardian.findUnique({ where: { accountEmail: normalized } })

  const passwordMatches = guardian?.passwordHash && (await verifyPassword(password, guardian.passwordHash))
  if (!guardian || !guardian.passwordHash || !passwordMatches) {
    throw new AppError('Invalid email or password.', HttpStatus.Unauthorized)
  }
  if (guardian.status !== 'ACTIVE') {
    throw new AppError('This account has been deactivated. Contact the school.', HttpStatus.Forbidden)
  }

  await prisma.guardian.update({ where: { id: guardian.id }, data: { lastLoginAt: new Date() } })
  await recordAudit({
    actorUserId: guardian.id,
    action: 'parent.login',
    resourceType: 'guardian',
    resourceId: guardian.id,
    ip: ip ?? null,
  })

  return {
    token: signToken(guardian.id, 'guardian'),
    user: toParentProfile(guardian),
  }
}

export async function getParentProfile(guardianId: string): Promise<ParentProfileView> {
  const guardian = await prisma.guardian.findUnique({
    where: { id: guardianId },
    include: { pupilGuardians: { select: { pupilId: true } } },
  })
  if (!guardian || !guardian.passwordHash) {
    throw new AppError('Account not found.', HttpStatus.NotFound)
  }
  return toParentProfile(guardian)
}

export async function changeParentPassword(
  guardianId: string,
  currentPassword: string,
  newPassword: string,
  ip?: string,
): Promise<void> {
  const guardian = await prisma.guardian.findUnique({ where: { id: guardianId } })
  if (!guardian || !guardian.passwordHash) {
    throw new AppError('Account not found.', HttpStatus.NotFound)
  }
  if (!(await verifyPassword(currentPassword, guardian.passwordHash))) {
    throw new AppError('Current password is incorrect.', HttpStatus.BadRequest)
  }
  const passwordHash = await hashPassword(newPassword)
  await prisma.guardian.update({
    where: { id: guardianId },
    data: { passwordHash, mustChangePassword: false },
  })
  await recordAudit({
    actorUserId: guardianId,
    action: 'parent.password_change',
    resourceType: 'guardian',
    resourceId: guardianId,
    ip: ip ?? null,
  })
}

/**
 * First-login password change for a guardian who authenticated with a
 * server-generated temporary password. The old temporary hash is replaced (and
 * thereby invalidated) and the `mustChangePassword` flag clears.
 */
export async function completeParentFirstPasswordChange(
  guardianId: string,
  newPassword: string,
  ip?: string,
): Promise<void> {
  const guardian = await prisma.guardian.findUnique({ where: { id: guardianId } })
  if (!guardian || !guardian.passwordHash) {
    throw new AppError('Account not found.', HttpStatus.NotFound)
  }
  if (!guardian.mustChangePassword) {
    throw new AppError('Your password is already set up. You can change it from your profile.', HttpStatus.BadRequest)
  }
  const passwordHash = await hashPassword(newPassword)
  await prisma.guardian.update({
    where: { id: guardianId },
    data: { passwordHash, mustChangePassword: false },
  })
  await recordAudit({
    actorUserId: guardianId,
    action: 'parent.first_password_change',
    resourceType: 'guardian',
    resourceId: guardianId,
    ip: ip ?? null,
  })
}