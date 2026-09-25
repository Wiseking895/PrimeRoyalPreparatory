import { HttpStatus } from '../config/enums'
import type { NextFunction, RequestHandler, Response } from 'express'
import { verifyTokenPayload } from '../lib/jwt'
import { prisma } from '../lib/prisma'
import type { AuthRequest, AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { asyncHandler } from '../utils/async-handler'

/**
 * Endpoints that must stay reachable while an account still carries the
 * `mustChangePassword` flag. Everything else is blocked so a Headteacher who
 * signed in with a temporary password cannot browse the normal dashboard until
 * they have set a real password.
 */
const FIRST_LOGIN_ALLOWLIST = new Set([
  '/api/auth/me',
  '/api/auth/change-password',
  '/api/auth/first-password-change',
])

function requestPath(originalUrl: string): string {
  return originalUrl.split('?')[0]
}

/**
 * Authenticates the bearer token and resolves the user's roles and
 * permissions from the database. Attaches `req.user` on success or rejects
 * with 401. This is the mandatory gate for every protected endpoint.
 *
 * Supports developer impersonation: when a token carries `imp: true` and `act`
 * (the acting user id), permissions are resolved from the acting user while
 * the real developer identity is preserved in `req.user.impersonator`.
 */
export const requireAuth: RequestHandler = asyncHandler(
  async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('Authentication required.', HttpStatus.Unauthorized)
    }

    const token = header.slice('Bearer '.length).trim()
    const payload = verifyTokenPayload(token)
    if (!payload) {
      throw new AppError('Invalid or expired session. Please sign in again.', HttpStatus.Unauthorized)
    }

    // Determine which user identity to resolve: acting user (impersonation) or the token subject.
    const resolveUserId = payload.imp && payload.act ? payload.act : payload.sub

    const user = await prisma.user.findUnique({
      where: { id: resolveUserId },
      include: {
        staffProfile: true,
        roles: { include: { role: { include: { rolePermissions: { include: { permission: true } } } } } },
      },
    })

    if (!user) {
      throw new AppError('Account not found.', HttpStatus.Unauthorized)
    }
    if (user.status !== 'ACTIVE') {
      throw new AppError('This account has been deactivated.', HttpStatus.Forbidden)
    }

    if (user.mustChangePassword && !FIRST_LOGIN_ALLOWLIST.has(requestPath(req.originalUrl))) {
      throw new AppError(
        'You must set a new password before you can continue.',
        HttpStatus.Forbidden,
      )
    }

    const permissionKeys = Array.from(
      new Set(user.roles.flatMap(({ role }) => role.rolePermissions.map(({ permission }) => permission.key))),
    )

    const authenticatedUser: AuthenticatedUser = {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      status: user.status,
      staffId: user.staffProfile?.staffId ?? null,
      roleNames: user.roles.map(({ role }) => role.name),
      permissionKeys,
    }

    // When impersonating, attach the real developer identity for auditing.
    if (payload.imp && payload.act) {
      const developer = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, fullName: true, email: true },
      })
      if (developer) {
        authenticatedUser.impersonator = {
          id: developer.id,
          fullName: developer.fullName,
          email: developer.email,
        }
      }
    }

    req.user = authenticatedUser
    next()
  },
)