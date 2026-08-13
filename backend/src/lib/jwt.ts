import jwt from 'jsonwebtoken'
import { env } from '../config/env'

/**
 * Signs an access token carrying the user id as the subject. The token never
 * carries the user's role — the role/permissions are always resolved from the
 * database on every authenticated request so a stale or forged role claim can
 * never be trusted.
 */
export function signToken(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, {
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