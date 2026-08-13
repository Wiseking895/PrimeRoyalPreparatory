import bcrypt from 'bcryptjs'
import { env } from '../config/env'

/**
 * Password hashing using bcrypt (industry standard, per-user random salt).
 * Plaintext passwords are never stored or logged.
 */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, env.passwordCost)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}