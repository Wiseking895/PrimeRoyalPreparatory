import { randomInt } from 'node:crypto'

const UPPERCASE = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const LOWERCASE = 'abcdefghijkmnpqrstuvwxyz'
const DIGITS = '23456789'
const AMBIGUOUS = new Set(['0', 'O', '1', 'l', 'I', 'o', '0'])

/**
 * Generates a cryptographically-random temporary password. Ambiguous
 * characters (0/O, 1/l/I) are excluded to make the value easy to relay by
 * voice or on paper. The result always includes an uppercase letter, a
 * lowercase letter and a digit so it satisfies the `passwordField` policy.
 *
 * Temporary passwords are delivered only through the invitation email (or the
 * development console transport); they are never persisted, logged or returned
 * by the API.
 */
export function generateTemporaryPassword(length = 14): string {
  const alphabet = `${UPPERCASE}${LOWERCASE}${DIGITS}`
  const parts: string[] = [
    UPPERCASE[randomInt(UPPERCASE.length)],
    LOWERCASE[randomInt(LOWERCASE.length)],
    DIGITS[randomInt(DIGITS.length)],
  ]

  while (parts.length < length) {
    const character = alphabet[randomInt(alphabet.length)]
    if (!AMBIGUOUS.has(character)) parts.push(character)
  }

  for (let index = parts.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1)
    ;[parts[index], parts[swapIndex]] = [parts[swapIndex], parts[index]]
  }

  return parts.join('')
}
