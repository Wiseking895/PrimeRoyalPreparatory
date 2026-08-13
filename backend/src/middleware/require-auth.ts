import { HttpStatus } from '@prps/shared'
import type { NextFunction, RequestHandler, Response } from 'express'
import { verifyToken } from '../lib/jwt'
import { prisma } from '../lib/prisma'
import type { AuthRequest, AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { asyncHandler } from '../utils/async-handler'

/**
 * Authenticates the bearer token and resolves the user's roles and
 * permissions from the database. Attaches `req.user` on success or rejects
 * with 401. This is the mandatory gate for every protected endpoint.
 */
export const requireAuth: RequestHandler = asyncHandler(
  async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('Authentication required.', HttpStatus.Unauthorized)
    }

    const token = header.slice('Bearer '.length).trim()
    const userId = verifyToken(token)
    if (!userId) {
      throw new AppError('Invalid or expired session. Please sign in again.', HttpStatus.Unauthorized)
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
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

    req.user = authenticatedUser
    next()
  },
)