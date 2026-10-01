import { randomUUID } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { HttpStatus } from '../config/enums.js'
import { AppError } from '../utils/app-error.js'

/**
 * Minimal Google OAuth 2.0 / OpenID Connect client for the first-time Owner
 * sign-up flow, built on Node's global `fetch` so no new dependency is added.
 *
 * Only two legs exist:
 *
 *   /api/auth/google/start   -> signs a short-lived CSRF `state`, redirects to
 *                               Google's authorization endpoint
 *   /api/auth/google/callback-> validates `state`, exchanges the `code` for the
 *                               verified identity, then hands the session token
 *                               back to the frontend in a URL fragment
 *
 * The access/id tokens themselves are never stored or exposed: only the
 * verified subject, e-mail address and display name are kept, and only long
 * enough to provision the Owner row.
 */

const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'

/**
 * Namespaces the CSRF `state` so it can never be mistaken for a session JWT:
 * `requireAuth` only ever sees tokens carrying `kind`, and this token only
 * carries `purpose`.
 */
const SETUP_STATE_PURPOSE = 'owner-setup'
const SETUP_STATE_EXPIRES_IN = '10m'
const REQUEST_TIMEOUT_MS = 15_000
const SCOPE = 'openid email profile'

/** Single message used for every failure inside the Google exchange. */
export const GOOGLE_SIGNIN_FAILED_MESSAGE =
  'Sign in with Google could not be completed. Please try again.'

/** Verified identity returned by Google. */
export interface GoogleProfile {
  googleId: string
  email: string
  fullName: string
}

export function isGoogleOAuthConfigured(): boolean {
  return env.googleOAuthEnabled
}

/** Signs the one-time CSRF `state` protecting the authorization request. */
export function signSetupState(): string {
  return jwt.sign({ purpose: SETUP_STATE_PURPOSE, nonce: randomUUID() }, env.jwtSecret, {
    expiresIn: SETUP_STATE_EXPIRES_IN,
  })
}

/**
 * Accepts only a state signed by this backend for this exact purpose. Anything
 * else (a session token, an expired token, a forged token) is rejected.
 */
export function verifySetupState(state: unknown): boolean {
  if (typeof state !== 'string' || state.length === 0) return false
  try {
    const payload = jwt.verify(state, env.jwtSecret) as jwt.JwtPayload
    return payload.purpose === SETUP_STATE_PURPOSE
  } catch {
    return false
  }
}

/**
 * The URI Google sends the user back to. Must match an entry in the Google
 * console exactly, so an explicitly configured value always wins.
 */
export function resolveRedirectUri(requestOrigin: string): string {
  if (env.googleRedirectUri) return env.googleRedirectUri
  return `${requestOrigin.replace(/\/+$/, '')}/api/auth/google/callback`
}

/** Builds the URL the browser is sent to in order to start the flow. */
export function buildAuthorizationUrl(redirectUri: string, state: string): string {
  const url = new URL(AUTHORIZATION_ENDPOINT)
  url.searchParams.set('client_id', env.googleClientId)
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', SCOPE)
  url.searchParams.set('state', state)
  // Always show the account chooser: onboarding is a one-time flow and the
  // wrong Google account would otherwise silently provision the wrong Owner.
  url.searchParams.set('prompt', 'select_account')
  return url.toString()
}

/**
 * Trades the authorization code for the verified identity.
 *
 * Throws `AppError` (400/502) with a message that is safe to show a browser:
 * tokens, secrets and provider payloads never appear in it.
 */
export async function exchangeCodeForProfile(code: string, redirectUri: string): Promise<GoogleProfile> {
  let tokenResponse: Response
  try {
    tokenResponse = await fetch(TOKEN_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.googleClientId,
        client_secret: env.googleClientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new AppError(GOOGLE_SIGNIN_FAILED_MESSAGE, HttpStatus.BadGateway)
  }

  if (!tokenResponse.ok) {
    throw new AppError(GOOGLE_SIGNIN_FAILED_MESSAGE, HttpStatus.BadGateway)
  }

  const tokens = (await tokenResponse.json()) as { access_token?: unknown }
  if (typeof tokens.access_token !== 'string' || !tokens.access_token) {
    throw new AppError(GOOGLE_SIGNIN_FAILED_MESSAGE, HttpStatus.BadGateway)
  }

  let profileResponse: Response
  try {
    profileResponse = await fetch(USERINFO_ENDPOINT, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    throw new AppError(GOOGLE_SIGNIN_FAILED_MESSAGE, HttpStatus.BadGateway)
  }

  if (!profileResponse.ok) {
    throw new AppError(GOOGLE_SIGNIN_FAILED_MESSAGE, HttpStatus.BadGateway)
  }

  const profile = (await profileResponse.json()) as Record<string, unknown>
  const googleId = typeof profile.sub === 'string' ? profile.sub.trim() : ''
  const email = typeof profile.email === 'string' ? profile.email.trim().toLowerCase() : ''

  if (!googleId || !email) {
    throw new AppError(
      'Your Google account did not share the email address this setup requires.',
      HttpStatus.BadRequest,
    )
  }
  if (profile.email_verified === false) {
    throw new AppError('The email address on your Google account is not verified yet.', HttpStatus.BadRequest)
  }

  const name = typeof profile.name === 'string' ? profile.name.trim() : ''
  return { googleId, email, fullName: name || email.split('@')[0] || 'School Owner' }
}
