import { env } from '../config/env.js'
import { HttpStatus } from '../config/enums.js'
import { logger } from '../config/logger.js'
import { ok } from '../lib/api-response.js'
import { signToken } from '../lib/jwt.js'
import type { AuthRequest } from '../types/auth.js'
import { AppError } from '../utils/app-error.js'
import { asyncHandler } from '../utils/async-handler.js'
import { changePassword, completeFirstPasswordChange, getUserProfile, login } from '../services/auth.service.js'
import { createOwnerFromGoogle, ownerExists } from '../services/setup.service.js'
import {
  buildAuthorizationUrl,
  exchangeCodeForProfile,
  isGoogleOAuthConfigured,
  resolveRedirectUri,
  signSetupState,
  verifySetupState,
} from '../services/google-oauth.service.js'

export const loginHandler = asyncHandler(async (req, res) => {
  const result = await login(req.body.identifier, req.body.password, req.ip)
  res.json(ok(result, 'Signed in successfully.'))
})

export const meHandler = asyncHandler(async (req: AuthRequest, res) => {
  const user = req.user
  const profile = await getUserProfile(user!.id)
  res.json(ok(profile))
})

export const changePasswordHandler = asyncHandler(async (req: AuthRequest, res) => {
  await changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword, req.ip)
  res.status(HttpStatus.Ok).json(ok(null, 'Password updated successfully.'))
})

export const firstPasswordChangeHandler = asyncHandler(async (req: AuthRequest, res) => {
  await completeFirstPasswordChange(req.user!.id, req.body.newPassword, req.ip)
  res.status(HttpStatus.Ok).json(ok(null, 'Password set successfully. You can now continue.'))
})

// ---------------------------------------------------------------------------
// Google OAuth — first-time school Owner sign-up only.
//
// These two endpoints exist solely for /setup/owner. They never authenticate an
// arbitrary user, never touch the dedicated Developer account and are not part
// of the normal /api/auth/login path.
// ---------------------------------------------------------------------------

/** Reasons surfaced to the frontend through `?error=` after a failed callback. */
type GoogleCallbackFailure = 'state' | 'denied' | 'profile' | 'unavailable'

/** Origin the browser is talking to (honours `X-Forwarded-Proto` via trust proxy). */
function requestOrigin(req: { protocol: string; get: (name: string) => string | undefined }): string {
  const host = req.get('host')
  if (!host) {
    throw new AppError('Unable to determine the request origin.', HttpStatus.BadRequest)
  }
  return `${req.protocol}://${host}`
}

/**
 * Browser failures are reported as a short reason code in the redirect query
 * string; the detailed cause is only ever written to the server log so the
 * callback URL never carries provider payloads.
 */
function failRedirect(res: { redirect: (url: string) => void }, reason: GoogleCallbackFailure): void {
  res.redirect(`${env.clientUrl}/setup/owner?error=${reason}`)
}

/**
 * `GET /api/auth/google/start`
 * Signs the CSRF `state` and sends the browser to Google's consent screen.
 */
export const googleStartHandler = asyncHandler(async (req, res) => {
  if (!isGoogleOAuthConfigured()) {
    throw new AppError(
      'Sign in with Google is not configured for this deployment.',
      HttpStatus.ServiceUnavailable,
    )
  }

  const redirectUri = resolveRedirectUri(requestOrigin(req))
  res.redirect(buildAuthorizationUrl(redirectUri, signSetupState()))
})

/**
 * `GET /api/auth/google/callback`
 * Validates `state`, exchanges the code, provisions the Owner (once) and hands
 * the session back to the frontend in a URL fragment — fragments are never
 * sent to a server or written into request logs.
 */
export const googleCallbackHandler = asyncHandler(async (req, res) => {
  const providerError = req.query.error
  if (typeof providerError === 'string' && providerError.length > 0) {
    logger.warn({ providerError }, 'Google Owner sign-in was not completed by the provider.')
    failRedirect(res, 'denied')
    return
  }

  const { code, state } = req.query
  if (!isGoogleOAuthConfigured()) {
    logger.warn('Google Owner sign-in rejected: OAuth is not configured.')
    failRedirect(res, 'unavailable')
    return
  }
  if (typeof code !== 'string' || code.length === 0 || !verifySetupState(state)) {
    logger.warn('Google Owner sign-in rejected: missing or invalid state.')
    failRedirect(res, 'state')
    return
  }

  try {
    const profile = await exchangeCodeForProfile(code, resolveRedirectUri(requestOrigin(req)))

    // The school Owner is a once-ever account. If one already exists, Google
    // sign-in must not create a second one — send the visitor to normal
    // sign-in instead. The dedicated Developer account never satisfies this
    // check, so it can never close the first-time flow either.
    if (await ownerExists()) {
      res.redirect(`${env.clientUrl}/login?setup=complete`)
      return
    }

    const user = await createOwnerFromGoogle(profile, req.ip)
    const token = signToken(user.id)
    res.redirect(`${env.clientUrl}/setup/owner#token=${encodeURIComponent(token)}`)
  } catch (err) {
    if (err instanceof AppError && err.statusCode === HttpStatus.Conflict) {
      res.redirect(`${env.clientUrl}/login?setup=complete`)
      return
    }
    if (err instanceof AppError) {
      logger.warn({ message: err.message, statusCode: err.statusCode }, 'Google Owner sign-in failed.')
      failRedirect(res, err.statusCode === HttpStatus.BadRequest ? 'profile' : 'unavailable')
      return
    }
    throw err
  }
})
