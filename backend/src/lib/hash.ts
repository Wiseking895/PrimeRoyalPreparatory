import crypto from 'node:crypto'

/**
 * SHA-256 of a binary buffer, lowercase hex.
 *
 * Used for document integrity: PostgreSQL stores the hash next to the object
 * metadata so PRPS can later verify that a stored object has not changed.
 * Node's built-in crypto is sufficient — no third-party hashing package.
 */
export function sha256Hex(data: Buffer | Uint8Array | string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}
