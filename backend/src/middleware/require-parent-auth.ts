import { HttpStatus } from '../config/enums'
import type { NextFunction, RequestHandler, Response } from 'express'
import { verifyTokenForKind } from '../lib/jwt'
import { prisma } from '../lib/prisma'
import type { ParentRequest } from '../types/auth'
import { AppError } from '../utils/app-error'
import { asyncHandler } from '../utils/async-handler'
import { toGuardianIdentity } from '../services/guardian-mapper'

/**
 * Parent-portal endpoints that must stay reachable while a guardian still
 * carries the `mustChangePassword` flag. Everything else is blocked so a parent
 * who signed in with a temporary password cannot browse the portal until they
 * have set a real password (mirrors the staff `requireAuth` allowlist).
 */
const FIRST_LOGIN_ALLOWLIST = new Set([
  '/api/parent/me',
  '/api/parent/change-password',
  '/api/parent/first-password-change',
])

function requestPath(originalUrl: string): string {
  return originalUrl.split('?')[0]
}

/**
 * Authenticates a Guardian bearer token (kind = `guardian`) and resolves the
 * guardian's account from the database. Attaches `req.parent` on success or
 * rejects with 401. This is the mandatory gate for every parent-portal
 * endpoint. Staff tokens are rejected because their `kind` claim is `staff`.
 */
export const requireParentAuth: RequestHandler = asyncHandler(
  async (req: ParentRequest, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization
    if (!header || !header.startsWith('Bearer ')) {
      throw new AppError('Authentication required.', HttpStatus.Unauthorized)
    }

    const token = header.slice('Bearer '.length).trim()
    const guardianId = verifyTokenForKind(token, 'guardian')
    if (!guardianId) {
      throw new AppError('Invalid or expired session. Please sign in again.', HttpStatus.Unauthorized)
    }

    const guardian = await prisma.guardian.findUnique({ where: { id: guardianId } })
    if (!guardian || !guardian.passwordHash) {
      throw new AppError('Account not found.', HttpStatus.Unauthorized)
    }
    if (guardian.status !== 'ACTIVE') {
      throw new AppError('This account has been deactivated.', HttpStatus.Forbidden)
    }

    if (guardian.mustChangePassword && !FIRST_LOGIN_ALLOWLIST.has(requestPath(req.originalUrl))) {
      throw new AppError('You must set a new password before you can continue.', HttpStatus.Forbidden)
    }

    req.parent = toGuardianIdentity(guardian)
    next()
  },
)