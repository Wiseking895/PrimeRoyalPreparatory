import request from 'supertest'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp } from '../app'

const verifyTokenPayloadMock = vi.hoisted(() => vi.fn())
const verifyTokenForKindMock = vi.hoisted(() => vi.fn())
const r2Mock = vi.hoisted(() => ({
  isR2Configured: vi.fn(() => true),
  putR2Object: vi.fn(() => Promise.resolve()),
  deleteR2Object: vi.fn(() => Promise.resolve()),
  getPresignedR2Url: vi.fn(() => Promise.resolve('https://acct.r2.test/key?X-Amz-Signature=sig')),
  checkR2Health: vi.fn(() =>
    Promise.resolve({
      configured: true,
      reachable: true,
      bucket: 'prps-private',
      endpointHost: 'acct.r2.test',
      message: 'Reachable (probe object absent — expected for a new bucket).',
    }),
  ),
  r2NotConfiguredError: vi.fn(),
}))
const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  guardian: { findUnique: vi.fn() },
  pupilGuardian: { findUnique: vi.fn() },
  storedDocument: { findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../lib/jwt', () => ({
  verifyTokenPayload: verifyTokenPayloadMock,
  verifyToken: verifyTokenPayloadMock,
  verifyTokenForKind: verifyTokenForKindMock,
  signToken: vi.fn(),
}))
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))
// R2 is mocked at the storage boundary — no live credentials are ever used.
vi.mock('../services/r2-storage.service', () => r2Mock)

const app = createApp()

function baseUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    fullName: 'Kofi Mensah',
    email: 'kofi@school.edu',
    phone: null,
    status: 'ACTIVE',
    staffProfile: null,
    mustChangePassword: false,
    roles: [],
    ...overrides,
  }
}

function roleEntry(name: string, keys: string[]) {
  return {
    role: {
      id: `role-${name}`,
      name,
      rolePermissions: keys.map((key) => ({ permission: { key } })),
    },
  }
}

function documentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    documentType: 'ADMISSION_FORM',
    storageProvider: 'r2',
    storageKey: 'admissions/p-1/year-1/doc-1.pdf',
    originalFileName: 'Admission-Form.pdf',
    mimeType: 'application/pdf',
    fileSize: 4096,
    sha256: 'a'.repeat(64),
    status: 'AVAILABLE',
    pupilId: 'p-1',
    userId: null,
    academicYearId: 'year-1',
    termId: null,
    relatedType: null,
    relatedId: null,
    createdById: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  verifyTokenPayloadMock.mockReturnValue({ sub: 'user-1', kind: 'staff' })
  verifyTokenForKindMock.mockReturnValue('guardian-1')
  r2Mock.isR2Configured.mockReturnValue(true)
  r2Mock.getPresignedR2Url.mockResolvedValue('https://acct.r2.test/key?X-Amz-Signature=sig')
  r2Mock.checkR2Health.mockResolvedValue({
    configured: true,
    reachable: true,
    bucket: 'prps-private',
    endpointHost: 'acct.r2.test',
    message: 'Reachable (probe object absent — expected for a new bucket).',
  })
  prismaMock.user.findUnique.mockResolvedValue(baseUser())
  prismaMock.guardian.findUnique.mockResolvedValue({
    id: 'guardian-1',
    passwordHash: 'hash',
    status: 'ACTIVE',
    mustChangePassword: false,
  })
  prismaMock.pupilGuardian.findUnique.mockResolvedValue({ pupilId: 'p-1' })
  prismaMock.storedDocument.findUnique.mockResolvedValue(documentRow())
  prismaMock.auditLog.create.mockResolvedValue({})
  prismaMock.$transaction.mockImplementation((arg: unknown) => {
    if (typeof arg === 'function') return arg(prismaMock)
    return Promise.resolve(arg)
  })
})

describe('GET /api/documents/:documentId/url (staff)', () => {
  it('rejects unauthenticated access with 401', async () => {
    const res = await request(app).get('/api/documents/doc-1/url')
    expect(res.status).toBe(401)
    expect(r2Mock.getPresignedR2Url).not.toHaveBeenCalled()
  })

  it('returns 404 for a document that does not exist', async () => {
    prismaMock.storedDocument.findUnique.mockResolvedValue(null)

    const res = await request(app).get('/api/documents/missing/url').set('Authorization', 'Bearer t')

    expect(res.status).toBe(404)
    expect(r2Mock.getPresignedR2Url).not.toHaveBeenCalled()
  })

  it('issues a presigned URL for an admission form and audits the download', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['pupils.view'])] }),
    )

    const res = await request(app).get('/api/documents/doc-1/url').set('Authorization', 'Bearer t')

    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.data).toMatchObject({
      documentId: 'doc-1',
      url: 'https://acct.r2.test/key?X-Amz-Signature=sig',
      expiresInSeconds: 300,
      mimeType: 'application/pdf',
    })
    // Only the presigned URL is returned — never the object key or credentials.
    expect(JSON.stringify(res.body)).not.toContain('admissions/p-1/year-1/doc-1.pdf')
    expect(JSON.stringify(res.body)).not.toContain('secret')
    expect(prismaMock.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'document.download',
      resourceType: 'document',
      resourceId: 'doc-1',
    })
  })

  it('rejects a user without pupils.view with 403', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('ACCOUNTANT', ['finance.view'])] }),
    )

    const res = await request(app).get('/api/documents/doc-1/url').set('Authorization', 'Bearer t')

    expect(res.status).toBe(403)
    expect(r2Mock.getPresignedR2Url).not.toHaveBeenCalled()
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
  })

  it('lets any user with pupils.view read a pupil profile photo without auditing avatar reads', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['pupils.view'])] }),
    )
    prismaMock.storedDocument.findUnique.mockResolvedValue(
      documentRow({
        documentType: 'PROFILE_PHOTO',
        storageKey: 'pupils/p-1/profile/doc-1.jpg',
        mimeType: 'image/jpeg',
        originalFileName: 'photo.jpg',
      }),
    )

    const res = await request(app).get('/api/documents/doc-1/url').set('Authorization', 'Bearer t')

    expect(res.status).toBe(200)
    expect(res.body.data.url).toContain('https://')
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
  })

  it('lets a staff member read their own profile photo without extra permissions', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser({ roles: [] }))
    prismaMock.storedDocument.findUnique.mockResolvedValue(
      documentRow({
        documentType: 'PROFILE_PHOTO',
        storageKey: 'staff/user-1/profile/doc-1.jpg',
        mimeType: 'image/jpeg',
        pupilId: null,
        userId: 'user-1',
        originalFileName: 'photo.jpg',
      }),
    )

    const res = await request(app).get('/api/documents/doc-1/url').set('Authorization', 'Bearer t')

    expect(res.status).toBe(200)
  })

  it('blocks another staff member’s photo without staff.view', async () => {
    prismaMock.user.findUnique.mockResolvedValue(baseUser({ roles: [] }))
    prismaMock.storedDocument.findUnique.mockResolvedValue(
      documentRow({
        documentType: 'PROFILE_PHOTO',
        storageKey: 'staff/user-2/profile/doc-1.jpg',
        mimeType: 'image/jpeg',
        pupilId: null,
        userId: 'user-2',
        originalFileName: 'photo.jpg',
      }),
    )

    const res = await request(app).get('/api/documents/doc-1/url').set('Authorization', 'Bearer t')

    expect(res.status).toBe(403)
    expect(r2Mock.getPresignedR2Url).not.toHaveBeenCalled()
  })
})

describe('GET /api/parent/documents/:documentId/url', () => {
  it('rejects staff tokens with 401', async () => {
    verifyTokenForKindMock.mockReturnValue(null)

    const res = await request(app).get('/api/parent/documents/doc-1/url').set('Authorization', 'Bearer t')

    expect(res.status).toBe(401)
    expect(r2Mock.getPresignedR2Url).not.toHaveBeenCalled()
  })

  it('issues a presigned URL for the guardian’s own child', async () => {
    const res = await request(app).get('/api/parent/documents/doc-1/url').set('Authorization', 'Bearer t')

    expect(res.status).toBe(200)
    expect(res.body.data.url).toContain('https://')
    expect(prismaMock.pupilGuardian.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { pupilId_guardianId: { pupilId: 'p-1', guardianId: 'guardian-1' } },
      }),
    )
    // Guardian downloads are audited without a staff actor id.
    expect(prismaMock.auditLog.create.mock.calls[0][0].data).toMatchObject({
      action: 'document.download',
      actorUserId: null,
    })
  })

  it('rejects documents of pupils the guardian is not linked to with 403', async () => {
    prismaMock.pupilGuardian.findUnique.mockResolvedValue(null)

    const res = await request(app).get('/api/parent/documents/doc-1/url').set('Authorization', 'Bearer t')

    expect(res.status).toBe(403)
    expect(r2Mock.getPresignedR2Url).not.toHaveBeenCalled()
  })

  it('does not reveal staff documents to the parent portal', async () => {
    prismaMock.storedDocument.findUnique.mockResolvedValue(
      documentRow({
        documentType: 'PROFILE_PHOTO',
        storageKey: 'staff/user-1/profile/doc-1.jpg',
        pupilId: null,
        userId: 'user-1',
        mimeType: 'image/jpeg',
      }),
    )

    const res = await request(app).get('/api/parent/documents/doc-1/url').set('Authorization', 'Bearer t')

    expect(res.status).toBe(404)
    expect(r2Mock.getPresignedR2Url).not.toHaveBeenCalled()
  })
})

describe('GET /api/health/storage', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/health/storage')
    expect(res.status).toBe(401)
    expect(r2Mock.checkR2Health).not.toHaveBeenCalled()
  })

  it('requires owner.manage', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('HEADTEACHER', ['pupils.view'])] }),
    )

    const res = await request(app).get('/api/health/storage').set('Authorization', 'Bearer t')

    expect(res.status).toBe(403)
  })

  it('reports configuration and reachability without exposing credentials', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      baseUser({ roles: [roleEntry('OWNER', ['owner.manage'])] }),
    )

    const res = await request(app).get('/api/health/storage').set('Authorization', 'Bearer t')

    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      configured: true,
      reachable: true,
      bucket: 'prps-private',
      endpointHost: 'acct.r2.test',
    })
    expect(JSON.stringify(res.body)).not.toMatch(/R2_SECRET|R2_ACCESS|secret-access/i)
  })
})
