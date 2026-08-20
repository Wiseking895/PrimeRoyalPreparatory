import { HttpStatus } from '../config/enums'
import { logger } from '../config/logger'
import { hashPassword } from '../lib/password'
import { generateTemporaryPassword } from '../lib/temporary-password'
import { prisma } from '../lib/prisma'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import { toGuardianView, type GuardianView } from './guardian-mapper'
import { maskEmail, sendGuardianInvitation, type MailResult } from './mail.service'

/**
 * Phase 7 guardian account administration.
 *
 * A guardian becomes a Parent Portal user only when the school provisions an
 * account: a server-generated temporary password is stored as a bcrypt hash,
 * the account is forced to change it on first sign-in, and the temporary
 * password is delivered exclusively through the invitation email — never
 * written to the audit log or returned by the API. Deactivating an account
 * blocks sign-in but keeps the hash so the account can be re-enabled later.
 */

const guardianListInclude = {
  _count: { select: { pupilGuardians: true } },
} as const

export interface GuardianListOptions {
  q?: string
  account?: 'has_account' | 'no_account'
  status?: 'ACTIVE' | 'INACTIVE'
}

export interface GuardianListResult {
  items: GuardianView[]
  total: number
}

export type GuardianInvitationResult = MailResult

export interface GuardianAccountResult {
  guardian: GuardianView
  invitation: GuardianInvitationResult
}

export async function listGuardians(options: GuardianListOptions = {}): Promise<GuardianListResult> {
  const { q, account, status } = options

  const where: Record<string, unknown> = {}
  if (account === 'has_account') where.passwordHash = { not: null }
  if (account === 'no_account') where.passwordHash = null
  if (status) where.status = status
  if (q) {
    where.OR = [
      { fullName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { accountEmail: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
    ]
  }

  const [guardians, total] = await Promise.all([
    prisma.guardian.findMany({
      where,
      include: guardianListInclude,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.guardian.count({ where }),
  ])

  return { items: guardians.map(toGuardianView), total }
}

export async function getGuardian(id: string): Promise<GuardianView> {
  const guardian = await prisma.guardian.findUnique({ where: { id }, include: guardianListInclude })
  if (!guardian) {
    throw new AppError('Guardian not found.', HttpStatus.NotFound)
  }
  return toGuardianView(guardian)
}

async function assertGuardianExists(id: string) {
  const guardian = await prisma.guardian.findUnique({ where: { id } })
  if (!guardian) {
    throw new AppError('Guardian not found.', HttpStatus.NotFound)
  }
  return guardian
}

/**
 * Provisions a Parent Portal account for a guardian. If the guardian already
 * holds an ACTIVE account the request is rejected (use the resend endpoint to
 * regenerate credentials); an INACTIVE account is re-enabled in place.
 */
export async function createParentAccount(
  actor: AuthenticatedUser,
  guardianId: string,
  input: { accountEmail?: string } = {},
  ip?: string,
): Promise<GuardianAccountResult> {
  const guardian = await assertGuardianExists(guardianId)

  const accountEmail = input.accountEmail?.trim().toLowerCase() || guardian.email?.trim().toLowerCase() || ''
  if (!accountEmail) {
    throw new AppError(
      'A valid email address is required to create a parent account. Add an email to the guardian record first.',
      HttpStatus.BadRequest,
    )
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(accountEmail)) {
    throw new AppError('Enter a valid email address.', HttpStatus.BadRequest)
  }

  const existing = await prisma.guardian.findUnique({ where: { accountEmail } })
  if (existing && existing.id !== guardianId) {
    throw new AppError('An account with this email already exists.', HttpStatus.Conflict)
  }
  if (existing && existing.status === 'ACTIVE' && existing.id === guardianId) {
    throw new AppError('This guardian already has an active parent account.', HttpStatus.Conflict)
  }

  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashPassword(temporaryPassword)

  await prisma.guardian.update({
    where: { id: guardianId },
    data: {
      accountEmail,
      passwordHash,
      status: 'ACTIVE',
      mustChangePassword: true,
      createdByUserId: actor.id,
    },
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'guardians.parent_account.create',
    resourceType: 'guardian',
    resourceId: guardianId,
    metadata: { accountEmail: maskEmail(accountEmail) },
    ip: ip ?? null,
  })

  const invitation = await sendGuardianInvitation({
    to: accountEmail,
    fullName: guardian.fullName,
    temporaryPassword,
  })

  logger.info(
    {
      channel: 'mail',
      action: 'guardians.parent_account.create',
      guardianId,
      to: maskEmail(accountEmail),
      transport: invitation.transport ?? null,
      status: invitation.status,
    },
    'Parent portal invitation requested.',
  )

  return { guardian: await getGuardian(guardianId), invitation }
}

/**
 * Re-sends a guardian's Parent Portal invitation. A fresh temporary password is
 * generated (invalidating any previously delivered one) and the account is
 * forced to change it on next sign-in.
 */
export async function resendParentInvitation(
  actor: AuthenticatedUser,
  guardianId: string,
  ip?: string,
): Promise<GuardianAccountResult> {
  const guardian = await assertGuardianExists(guardianId)
  if (!guardian.accountEmail || !guardian.passwordHash) {
    throw new AppError('This guardian does not have a parent account yet.', HttpStatus.BadRequest)
  }

  const temporaryPassword = generateTemporaryPassword()
  const passwordHash = await hashPassword(temporaryPassword)
  await prisma.guardian.update({
    where: { id: guardianId },
    data: { passwordHash, mustChangePassword: true, status: 'ACTIVE' },
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'guardians.parent_account.resend',
    resourceType: 'guardian',
    resourceId: guardianId,
    metadata: { accountEmail: maskEmail(guardian.accountEmail) },
    ip: ip ?? null,
  })

  const invitation = await sendGuardianInvitation({
    to: guardian.accountEmail,
    fullName: guardian.fullName,
    temporaryPassword,
  })

  logger.info(
    {
      channel: 'mail',
      action: 'guardians.parent_account.resend',
      guardianId,
      to: maskEmail(guardian.accountEmail),
      transport: invitation.transport ?? null,
      status: invitation.status,
    },
    'Parent portal invitation requested.',
  )

  return { guardian: await getGuardian(guardianId), invitation }
}

export async function setParentAccountStatus(
  actor: AuthenticatedUser,
  guardianId: string,
  status: 'ACTIVE' | 'INACTIVE',
  ip?: string,
): Promise<GuardianView> {
  const guardian = await assertGuardianExists(guardianId)
  if (!guardian.passwordHash) {
    throw new AppError('This guardian does not have a parent account yet.', HttpStatus.BadRequest)
  }
  if (guardian.status === status) {
    return getGuardian(guardianId)
  }

  await prisma.guardian.update({ where: { id: guardianId }, data: { status } })
  await recordAudit({
    actorUserId: actor.id,
    action: status === 'ACTIVE' ? 'guardians.parent_account.activate' : 'guardians.parent_account.deactivate',
    resourceType: 'guardian',
    resourceId: guardianId,
    ip: ip ?? null,
  })

  return getGuardian(guardianId)
}