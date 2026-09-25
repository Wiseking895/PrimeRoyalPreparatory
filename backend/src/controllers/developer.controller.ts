import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import { signImpersonationToken } from '../lib/jwt'
import type { AuthRequest } from '../types/auth'
import { AppError } from '../utils/app-error'
import { asyncHandler } from '../utils/async-handler'
import {
  isDeveloperAccount,
  listImpersonatableAccounts,
  validateImpersonationTarget,
  recordImpersonationStart,
  recordImpersonationEnd,
  recordImpersonationSwitch,
} from '../services/developer.service'
import { toPublicUser } from '../services/user-mapper'

/**
 * Resolves the real developer account id for the current request.
 *
 * `requireAuth` rewrites `req.user.id` to the acting user when the bearer
 * token is an impersonation token. Developer authorization must always be
 * evaluated against the original developer identity (token `sub`), which is
 * preserved on `req.user.impersonator`. On a fresh developer login there is
 * no impersonator and `req.user.id` is already the developer.
 */
function resolveDeveloperId(user: NonNullable<AuthRequest['user']>): string {
  return user.impersonator?.id ?? user.id
}

/**
 * GET /api/developer/accounts
 *
 * Returns the list of active accounts available for developer impersonation.
 * Only accessible to the dedicated developer account.
 */
export const listDeveloperAccountsHandler = asyncHandler(async (req: AuthRequest, res) => {
  const developerId = resolveDeveloperId(req.user!)
  if (!(await isDeveloperAccount(developerId))) {
    throw new AppError('Forbidden: developer access only.', HttpStatus.Forbidden)
  }

  const accounts = await listImpersonatableAccounts()
  res.json(ok(accounts, 'Developer accounts retrieved successfully.'))
})

/**
 * POST /api/developer/impersonate
 *
 * Starts impersonation of a target user. Returns a new JWT that carries both
 * the real developer identity and the acting user context.
 */
export const startImpersonationHandler = asyncHandler(async (req: AuthRequest, res) => {
  const developerId = resolveDeveloperId(req.user!)
  if (!(await isDeveloperAccount(developerId))) {
    throw new AppError('Forbidden: developer access only.', HttpStatus.Forbidden)
  }

  const { targetUserId } = req.body as { targetUserId?: string }
  if (!targetUserId || typeof targetUserId !== 'string') {
    throw new AppError('targetUserId is required.', HttpStatus.BadRequest)
  }

  const target = await validateImpersonationTarget(targetUserId)
  const impersonationToken = signImpersonationToken(developerId, target.id)
  await recordImpersonationStart(developerId, target.id, req.ip)

  const actingUser = toPublicUser(target)

  res.json(ok({ token: impersonationToken, actingUser }, 'Impersonation started.'))
})

/**
 * POST /api/developer/stop-impersonation
 *
 * Stops the current impersonation session. Returns a fresh developer token
 * (non-impersonating) so the developer stays authenticated.
 */
export const stopImpersonationHandler = asyncHandler(async (req: AuthRequest, res) => {
  const developerId = resolveDeveloperId(req.user!)
  if (!(await isDeveloperAccount(developerId))) {
    throw new AppError('Forbidden: developer access only.', HttpStatus.Forbidden)
  }

  const { signToken } = await import('../lib/jwt')
  const freshDeveloperToken = signToken(developerId, 'staff')

  if (req.user?.impersonator) {
    await recordImpersonationEnd(developerId, req.user.id, req.ip)
  }

  res.json(ok({ token: freshDeveloperToken }, 'Impersonation ended.'))
})

/**
 * POST /api/developer/switch-account
 *
 * Switches from one impersonated account to another without returning to
 * the developer's own session first.
 */
export const switchImpersonationHandler = asyncHandler(async (req: AuthRequest, res) => {
  const developerId = resolveDeveloperId(req.user!)
  if (!(await isDeveloperAccount(developerId))) {
    throw new AppError('Forbidden: developer access only.', HttpStatus.Forbidden)
  }

  const { targetUserId } = req.body as { targetUserId?: string }
  if (!targetUserId || typeof targetUserId !== 'string') {
    throw new AppError('targetUserId is required.', HttpStatus.BadRequest)
  }

  const previousActingUserId = req.user!.id
  const target = await validateImpersonationTarget(targetUserId)
  const impersonationToken = signImpersonationToken(developerId, target.id)
  await recordImpersonationSwitch(developerId, previousActingUserId, target.id, req.ip)

  const actingUser = toPublicUser(target)

  res.json(ok({ token: impersonationToken, actingUser }, 'Account switched.'))
})
