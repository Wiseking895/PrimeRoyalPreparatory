import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * R2 storage tests. The AWS SDK is mocked at module level: these tests never
 * contact Cloudflare and never load real credentials.
 */
const sdk = vi.hoisted(() => {
  const send = vi.fn()
  class S3Client {
    constructor(_config: unknown) {}
    send = send
  }
  class PutObjectCommand {
    input: Record<string, unknown>
    constructor(input: Record<string, unknown>) {
      this.input = input
    }
  }
  class HeadObjectCommand {
    input: Record<string, unknown>
    constructor(input: Record<string, unknown>) {
      this.input = input
    }
  }
  class GetObjectCommand {
    input: Record<string, unknown>
    constructor(input: Record<string, unknown>) {
      this.input = input
    }
  }
  class DeleteObjectCommand {
    input: Record<string, unknown>
    constructor(input: Record<string, unknown>) {
      this.input = input
    }
  }
  const getSignedUrl = vi.fn()
  return {
    send,
    getSignedUrl,
    S3Client,
    PutObjectCommand,
    HeadObjectCommand,
    GetObjectCommand,
    DeleteObjectCommand,
  }
})

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: sdk.S3Client,
  PutObjectCommand: sdk.PutObjectCommand,
  HeadObjectCommand: sdk.HeadObjectCommand,
  GetObjectCommand: sdk.GetObjectCommand,
  DeleteObjectCommand: sdk.DeleteObjectCommand,
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: sdk.getSignedUrl }))

import type * as R2StorageService from './r2-storage.service'

type R2Module = typeof R2StorageService

const R2_VARS = [
  'R2_ACCOUNT_ID',
  'R2_ENDPOINT',
  'R2_BUCKET_NAME',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_PRESIGN_EXPIRES_IN',
]

/**
 * Re-imports the service with a controlled environment: `env` is read once at
 * module load, so each configuration needs a fresh module registry.
 */
async function loadR2(overrides: Record<string, string> = {}): Promise<R2Module> {
  vi.resetModules()
  for (const name of R2_VARS) {
    vi.stubEnv(name, overrides[name] ?? '')
  }
  return import('./r2-storage.service')
}

const configuredEnv = {
  R2_ACCOUNT_ID: 'acct-1',
  R2_ENDPOINT: 'https://acct-1.r2.cloudflarestorage.com',
  R2_BUCKET_NAME: 'prps-private',
  R2_ACCESS_KEY_ID: 'access-key-id',
  R2_SECRET_ACCESS_KEY: 'secret-access-key',
}

beforeEach(() => {
  sdk.send.mockReset()
  sdk.getSignedUrl.mockReset()
  sdk.getSignedUrl.mockImplementation(() =>
    Promise.resolve('https://account.r2.cloudflarestorage.com/bucket/key?X-Amz-Signature=abc'),
  )
})

describe('r2-storage.service (configured)', () => {
  it('uploads an object to the private bucket without any public ACL', async () => {
    const r2 = await loadR2(configuredEnv)
    sdk.send.mockResolvedValue({})

    await r2.putR2Object({
      key: 'admissions/p-1/2026/doc-1.pdf',
      body: Buffer.from('pdf-bytes'),
      contentType: 'application/pdf',
      metadata: { documentId: 'doc-1' },
    })

    expect(sdk.send).toHaveBeenCalledTimes(1)
    const command = sdk.send.mock.calls[0][0]
    expect(command).toBeInstanceOf(sdk.PutObjectCommand)
    expect(command.input.Bucket).toBe('prps-private')
    expect(command.input.Key).toBe('admissions/p-1/2026/doc-1.pdf')
    expect(command.input.ContentType).toBe('application/pdf')
    expect(command.input.Metadata).toEqual({ documentId: 'doc-1' })
    // Private bucket: objects are never made publicly readable.
    expect(command.input).not.toHaveProperty('ACL')
    expect(JSON.stringify(command.input)).not.toContain('secret-access-key')
  })

  it('reports object existence with HeadObject and treats 404 as missing', async () => {
    const r2 = await loadR2(configuredEnv)

    sdk.send.mockResolvedValue({})
    await expect(r2.r2ObjectExists('a/b/c.jpg')).resolves.toBe(true)

    sdk.send.mockRejectedValue(
      Object.assign(new Error('NotFound'), { $metadata: { httpStatusCode: 404 } }),
    )
    await expect(r2.r2ObjectExists('a/b/c.jpg')).resolves.toBe(false)
  })

  it('turns storage failures into a clear 503 without leaking details', async () => {
    const r2 = await loadR2(configuredEnv)
    sdk.send.mockRejectedValue(new Error('socket hang up'))

    const error = await r2
      .putR2Object({ key: 'k/x.bin', body: 'x', contentType: 'text/plain' })
      .catch((e: unknown) => e)
    expect(error).toMatchObject({ statusCode: 503 })
    expect(String((error as Error).message)).toContain('Object storage upload failed')
    expect(String((error as Error).message)).not.toContain('secret')
  })

  it('issues presigned GET URLs with an expiry and optional download name', async () => {
    const r2 = await loadR2(configuredEnv)

    const url = await r2.getPresignedR2Url('admissions/p-1/2026/doc-1.pdf', {
      downloadFileName: 'Admission Form.pdf',
      expiresIn: 60,
    })

    expect(url).toContain('https://')
    expect(sdk.getSignedUrl).toHaveBeenCalledTimes(1)
    const [, command, options] = sdk.getSignedUrl.mock.calls[0]
    expect(command).toBeInstanceOf(sdk.GetObjectCommand)
    expect(command.input.Bucket).toBe('prps-private')
    expect(command.input.Key).toBe('admissions/p-1/2026/doc-1.pdf')
    expect(command.input.ResponseContentDisposition).toBe(
      'attachment; filename="Admission Form.pdf"',
    )
    expect(options).toEqual({ expiresIn: 60 })
  })

  it('defaults the presigned expiry to the configured value (300s)', async () => {
    const r2 = await loadR2(configuredEnv)
    await r2.getPresignedR2Url('k/x.bin')
    const [, , options] = sdk.getSignedUrl.mock.calls[0]
    expect(options).toEqual({ expiresIn: 300 })
  })

  it('deletes objects through DeleteObjectCommand', async () => {
    const r2 = await loadR2(configuredEnv)
    sdk.send.mockResolvedValue({})

    await r2.deleteR2Object('pupils/p-1/profile/doc-2.jpg')

    const command = sdk.send.mock.calls[0][0]
    expect(command).toBeInstanceOf(sdk.DeleteObjectCommand)
    expect(command.input.Key).toBe('pupils/p-1/profile/doc-2.jpg')
  })

  it('reads objects server-side and returns their bytes', async () => {
    const r2 = await loadR2(configuredEnv)
    sdk.send.mockResolvedValue({
      Body: { transformToByteArray: () => Promise.resolve(new Uint8Array([1, 2, 3])) },
    })

    const bytes = await r2.getR2Object('k/x.bin')
    expect(bytes).toEqual(Buffer.from([1, 2, 3]))
  })

  it('maps a missing object on download to 404', async () => {
    const r2 = await loadR2(configuredEnv)
    sdk.send.mockRejectedValue(
      Object.assign(new Error('NotFound'), { $metadata: { httpStatusCode: 404 } }),
    )

    await expect(r2.getR2Object('k/x.bin')).rejects.toMatchObject({ statusCode: 404 })
  })

  it.each([
    ['leading slash', '/etc/passwd'],
    ['parent traversal', 'admissions/../../secret.pdf'],
    ['backslash', 'a' + String.fromCharCode(92) + 'b'],
    ['control character', 'a' + String.fromCharCode(7) + 'b'],
    ['wildcard', 'a*b'],
    ['question mark', 'a?b'],
    ['empty', ''],
  ])('rejects unsafe object keys (%s)', async (_label, key) => {
    const r2 = await loadR2(configuredEnv)
    sdk.send.mockResolvedValue({})

    await expect(
      r2.putR2Object({ key, body: 'x', contentType: 'text/plain' }),
    ).rejects.toMatchObject({
      message: 'Invalid document storage key.',
    })
    expect(sdk.send).not.toHaveBeenCalled()
  })

  it('reports a healthy bucket with a non-destructive HeadObject probe', async () => {
    const r2 = await loadR2(configuredEnv)
    sdk.send.mockResolvedValue({})

    const health = await r2.checkR2Health()
    expect(health).toMatchObject({ configured: true, reachable: true, bucket: 'prps-private' })
    const command = sdk.send.mock.calls[0][0]
    expect(command).toBeInstanceOf(sdk.HeadObjectCommand)
    // Never writes a probe object — only checks one.
    expect(sdk.send.mock.calls.every(([cmd]) => !(cmd instanceof sdk.PutObjectCommand))).toBe(true)
  })
})

describe('r2-storage.service (not configured)', () => {
  it('fails every storage operation with a clear, actionable 503', async () => {
    const r2 = await loadR2({
      R2_ACCOUNT_ID: 'acct-1',
      R2_ENDPOINT: '',
      R2_BUCKET_NAME: '',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
    })
    expect(r2.isR2Configured()).toBe(false)
    expect(r2.missingR2Variables()).toEqual([
      'R2_ENDPOINT',
      'R2_BUCKET_NAME',
      'R2_ACCESS_KEY_ID',
      'R2_SECRET_ACCESS_KEY',
    ])

    const operations = [
      r2.putR2Object({ key: 'a/b.bin', body: 'x', contentType: 'text/plain' }),
      r2.r2ObjectExists('a/b.bin'),
      r2.getR2Object('a/b.bin'),
      r2.deleteR2Object('a/b.bin'),
      r2.getPresignedR2Url('a/b.bin'),
    ]
    for (const operation of operations) {
      await expect(operation).rejects.toMatchObject({ statusCode: 503 })
    }
    await expect(
      r2.putR2Object({ key: 'a/b.bin', body: 'x', contentType: 'text/plain' }),
    ).rejects.toThrow(/R2_ENDPOINT.*R2_BUCKET_NAME.*R2_ACCESS_KEY_ID.*R2_SECRET_ACCESS_KEY/)
    expect(sdk.send).not.toHaveBeenCalled()
  })

  it('keeps the health check informative without failing', async () => {
    const r2 = await loadR2({
      R2_ACCOUNT_ID: '',
      R2_ENDPOINT: '',
      R2_BUCKET_NAME: '',
      R2_ACCESS_KEY_ID: '',
      R2_SECRET_ACCESS_KEY: '',
    })

    const health = await r2.checkR2Health()
    expect(health).toMatchObject({ configured: false, reachable: false, bucket: '(not set)' })
    expect(health.message).toContain('R2_ENDPOINT')
  })
})
