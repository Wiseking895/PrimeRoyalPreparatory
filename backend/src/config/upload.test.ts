import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { MAX_UPLOAD_FILE_BYTES, MAX_UPLOAD_FILE_MB } from './upload'

const HERE = path.dirname(fileURLToPath(import.meta.url))

/** Vercel serverless request-body ceiling (4.5 MB) that uploads must stay under. */
const VERCEL_REQUEST_BODY_BYTES = 4.5 * 1024 * 1024

/** Every module that enforces the multipart upload size. */
const UPLOAD_LIMIT_CONSUMERS = [
  '../routes/upload.routes.ts',
  '../routes/pupil.routes.ts',
  '../services/upload.service.ts',
  '../services/pupil-import.service.ts',
]

describe('backend upload size limit', () => {
  it('is a single 4 MB value below the Vercel request-body ceiling', () => {
    expect(MAX_UPLOAD_FILE_BYTES).toBe(4 * 1024 * 1024)
    expect(MAX_UPLOAD_FILE_MB).toBe(4)
    expect(MAX_UPLOAD_FILE_BYTES).toBeLessThan(VERCEL_REQUEST_BODY_BYTES)
  })

  it('is the only byte limit referenced by every multipart route and service', () => {
    for (const relative of UPLOAD_LIMIT_CONSUMERS) {
      const source = fs.readFileSync(path.resolve(HERE, relative), 'utf8')
      expect(source, `${relative} must use the shared upload limit`).toContain(
        'MAX_UPLOAD_FILE_BYTES',
      )
      expect(source, `${relative} must not hardcode a byte limit`).not.toContain('1024 * 1024')
    }
  })
})
