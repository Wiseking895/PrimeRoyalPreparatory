import { HttpStatus } from '../config/enums'
import type { NextFunction, RequestHandler, Response } from 'express'
import type { AuthRequest } from '../types/auth'
import { AppError } from '../utils/app-error'
import { asyncHandler } from '../utils/async-handler'

/**
 * Authorization guard. Requires any one of the supplied permission keys on the
 * authenticated user. Always paired after `requireAuth`.
 */
export function requirePermission(...required: string[]): RequestHandler {
  return asyncHandler(async (req: AuthRequest, _res: Response, next: NextFunction) => {
    const user = req.user
    if (!user) {
      throw new AppError('Authentication required.', HttpStatus.Unauthorized)
    }
    if (!required.some((permission) => user.permissionKeys.includes(permission))) {
      throw new AppError('Forbidden: you do not have permission to perform this action.', HttpStatus.Forbidden)
    }
    next()
  })
}