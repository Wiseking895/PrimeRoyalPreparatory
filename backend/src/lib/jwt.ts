import jwt from 'jsonwebtoken'
import { env } from '../config/env'

/**
 * Signs an access token carrying the user id as the subject. The token never
 * carries the user's role — the role/permissions are always resolved from the
 * database on every authenticated request so a stale or forged role claim can
 * never be trusted.
 *
 * The `kind` claim namespaces tokens so staff tokens (`sub` = User id) and
 * parent tokens (`sub` = Guardian id) can never be mistaken for one another:
 * `requireAuth` only accepts `kind === 'staff'`/absent and `requireParentAuth`
 * only accepts `kind === 'guardian'`.
 */
export function signToken(userId: string, kind: 'staff' | 'guardian' = 'staff'): string {
  return jwt.sign({ sub: userId, kind }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
  })
}

/**
 * Verifies a token and returns the user id (subject), or null when the token
 * is invalid or expired.
 */
export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}

/**
 * Verifies a token for a specific identity kind. Returns the subject id only
 * when the token is valid AND its `kind` claim matches (or is absent for staff,
 * which covers legacy tokens signed before the kind claim was introduced).
 */
export function verifyTokenForKind(token: string, kind: 'staff' | 'guardian'): string | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as jwt.JwtPayload
    const tokenKind = payload.kind ?? 'staff'
    if (tokenKind !== kind) return null
    return typeof payload.sub === 'string' ? payload.sub : null
  } catch {
    return null
  }
}