import { HttpStatus } from '../config/enums'
import { signToken } from '../lib/jwt'
import { hashPassword, verifyPassword } from '../lib/password'
import { prisma } from '../lib/prisma'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import { toPublicUser, type PublicUser } from './user-mapper'

const userInclude = {
  staffProfile: true,
  roles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
} as const

export interface LoginResult {
  token: string
  user: PublicUser
}

export async function login(identifier: string, password: string, ip?: string): Promise<LoginResult> {
  const normalized = identifier.trim().toLowerCase()
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: normalized }, { phone: normalized }, { staffProfile: { staffId: identifier.trim() } }],
    },
    include: userInclude,
  })

  const passwordMatches = user && (await verifyPassword(password, user.passwordHash))
  if (!user || !passwordMatches) {
    throw new AppError('Invalid email, staff ID, or password.', HttpStatus.Unauthorized)
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError('This account has been deactivated. Contact your administrator.', HttpStatus.Forbidden)
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
  await recordAudit({ actorUserId: user.id, action: 'auth.login', resourceType: 'user', resourceId: user.id, ip: ip ?? null })

  return { token: signToken(user.id), user: toPublicUser(user) }
}

export async function getUserProfile(userId: string): Promise<PublicUser> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: userInclude })
  if (!user) {
    throw new AppError('Account not found.', HttpStatus.NotFound)
  }
  return toPublicUser(user)
}

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  ip?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError('Account not found.', HttpStatus.NotFound)
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    throw new AppError('Current password is incorrect.', HttpStatus.BadRequest)
  }
  const passwordHash = await hashPassword(newPassword)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } })
  await recordAudit({
    actorUserId: userId,
    action: 'auth.password_change',
    resourceType: 'user',
    resourceId: userId,
    ip: ip ?? null,
  })
}

/**
 * First-login password change for accounts created with a server-generated
 * temporary password. The user already authenticated with the temporary
 * credential, so the current password is not requested again — but the account
 * must still be flagged `mustChangePassword`. After this succeeds the old
 * temporary hash is replaced (and thereby invalidated) and the flag clears.
 */
export async function completeFirstPasswordChange(
  userId: string,
  newPassword: string,
  ip?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError('Account not found.', HttpStatus.NotFound)
  }
  if (!user.mustChangePassword) {
    throw new AppError('Your password is already set up. You can change it from your profile.', HttpStatus.BadRequest)
  }
  const passwordHash = await hashPassword(newPassword)
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, mustChangePassword: false } })
  await recordAudit({
    actorUserId: userId,
    action: 'auth.first_password_change',
    resourceType: 'user',
    resourceId: userId,
    ip: ip ?? null,
  })
}