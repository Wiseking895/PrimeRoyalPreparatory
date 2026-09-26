import type { StoredDocument } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppError } from '../utils/app-error'

const r2Mock = vi.hoisted(() => ({
  isR2Configured: vi.fn(() => true),
  putR2Object: vi.fn(),
  deleteR2Object: vi.fn(),
  getPresignedR2Url: vi.fn(),
}))

const prismaMock = vi.hoisted(() => ({
  storedDocument: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: { create: vi.fn() },
}))

vi.mock('./r2-storage.service', () => r2Mock)
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

import {
  buildAdmissionFormKey,
  buildPupilProfileKey,
  buildStaffProfileKey,
  documentIdFromReference,
  documentReference,
  isDocumentReference,
  issueDocumentUrl,
  removeStoredDocument,
  sha256Hex,
  storeDocument,
  supersedeOlderAdmissionForms,
} from './document-storage.service'

const baseInput = {
  documentType: 'PROFILE_PHOTO' as const,
  buildKey: (id: string) => buildPupilProfileKey('p-1', id, '.jpg'),
  body: Buffer.from('image-bytes'),
  mimeType: 'image/jpeg',
  pupilId: 'p-1',
  academicYearId: null,
  userId: null,
  actorUserId: 'user-1',
}

function availableDocument(overrides: Record<string, unknown> = {}): StoredDocument {
  return {
    id: 'doc-1',
    documentType: 'ADMISSION_FORM',
    storageProvider: 'r2',
    storageKey: 'admissions/p-1/2026/doc-1.pdf',
    originalFileName: 'Admission-Form.pdf',
    mimeType: 'application/pdf',
    fileSize: 1234,
    sha256: 'a'.repeat(64),
    status: 'AVAILABLE',
    pupilId: 'p-1',
    userId: null,
    academicYearId: '2026',
    termId: null,
    relatedType: null,
    relatedId: null,
    createdById: 'user-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  } as StoredDocument
}

beforeEach(() => {
  vi.clearAllMocks()
  r2Mock.isR2Configured.mockReturnValue(true)
  r2Mock.putR2Object.mockResolvedValue(undefined)
  r2Mock.deleteR2Object.mockResolvedValue(undefined)
  r2Mock.getPresignedR2Url.mockResolvedValue('https://r2.test/presigned?sig=abc')
  prismaMock.storedDocument.findFirst.mockResolvedValue(null)
  prismaMock.storedDocument.findUnique.mockResolvedValue(null)
  prismaMock.storedDocument.create.mockResolvedValue({ id: 'doc-1' })
  prismaMock.storedDocument.update.mockImplementation(
    async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
      ...availableDocument(),
      id: args.where.id,
      ...args.data,
    }),
  )
  prismaMock.storedDocument.updateMany.mockResolvedValue({ count: 0 })
  prismaMock.storedDocument.delete.mockResolvedValue({})
  prismaMock.auditLog.create.mockResolvedValue({})
})

describe('object key layout', () => {
  it('files admission forms under pupil + academic year + document id', () => {
    expect(buildAdmissionFormKey('p-1', 'year-1', 'doc-1')).toBe(
      'admissions/p-1/year-1/doc-1.pdf',
    )
    // No active session: scoped as "unscoped" rather than omitted.
    expect(buildAdmissionFormKey('p-1', null, 'doc-1')).toBe('admissions/p-1/unscoped/doc-1.pdf')
  })

  it('keeps profile photos in per-subject prefixes', () => {
    expect(buildPupilProfileKey('p-1', 'doc-2', '.png')).toBe('pupils/p-1/profile/doc-2.png')
    expect(buildPupilProfileKey('p-1', 'doc-2', 'png')).toBe('pupils/p-1/profile/doc-2.png')
    expect(buildStaffProfileKey('u-1', 'doc-3', '.webp')).toBe('staff/u-1/profile/doc-3.webp')
  })

  it('exposes only internal document references, never storage keys or URLs', () => {
    const reference = documentReference('doc-1')
    expect(reference).toBe('/api/documents/doc-1')
    expect(isDocumentReference(reference)).toBe(true)
    expect(isDocumentReference('/api/uploads/profile-pictures/a.jpg')).toBe(false)
    expect(isDocumentReference('https://cdn.example.com/x.png')).toBe(false)
    expect(isDocumentReference(null)).toBe(false)
    expect(documentIdFromReference(reference)).toBe('doc-1')
  })
})

describe('sha256 integrity', () => {
  it('computes the standard SHA-256 digest', () => {
    expect(sha256Hex(Buffer.from(''))).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    )
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
  })
})

describe('storeDocument', () => {
  it('creates an UPLOADING row, writes the object, then flips to AVAILABLE', async () => {
    const result = await storeDocument({
      ...baseInput,
      audit: { action: 'pupil.picture_upload', resourceType: 'pupil', resourceId: 'p-1' },
    })

    expect(result.reused).toBe(false)
    expect(prismaMock.storedDocument.create).toHaveBeenCalledTimes(1)
    const created = prismaMock.storedDocument.create.mock.calls[0][0].data
    expect(created.status).toBe('UPLOADING')
    expect(created.documentType).toBe('PROFILE_PHOTO')
    expect(created.sha256).toBe(sha256Hex(Buffer.from('image-bytes')))
    expect(created.fileSize).toBe(Buffer.from('image-bytes').byteLength)
    expect(created.storageKey).toMatch(/^pending\//)

    expect(r2Mock.putR2Object).toHaveBeenCalledTimes(1)
    expect(r2Mock.putR2Object.mock.calls[0][0]).toMatchObject({
      key: 'pupils/p-1/profile/doc-1.jpg',
      contentType: 'image/jpeg',
    })

    expect(prismaMock.storedDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: { storageKey: 'pupils/p-1/profile/doc-1.jpg', status: 'AVAILABLE' },
      }),
    )
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'pupil.picture_upload' }),
      }),
    )
    expect(result.document).toMatchObject({ status: 'AVAILABLE' })
  })

  it('reuses identical content instead of storing it twice', async () => {
    const existing = availableDocument()
    prismaMock.storedDocument.findFirst.mockResolvedValue(existing)

    const result = await storeDocument({
      ...baseInput,
      audit: { action: 'pupil.picture_upload', resourceType: 'pupil', resourceId: 'p-1' },
    })

    expect(result.reused).toBe(true)
    expect(result.document).toEqual(existing)
    expect(prismaMock.storedDocument.create).not.toHaveBeenCalled()
    expect(r2Mock.putR2Object).not.toHaveBeenCalled()
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe(
      'pupil.picture_upload_reused',
    )
  })

  it('marks the row FAILED, audits and rethrows when the upload fails', async () => {
    r2Mock.putR2Object.mockRejectedValue(new AppError('Object storage upload failed.', 503))

    await expect(storeDocument(baseInput)).rejects.toMatchObject({ statusCode: 503 })

    expect(prismaMock.storedDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: { storageKey: 'pupils/p-1/profile/doc-1.jpg', status: 'FAILED' },
      }),
    )
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe(
      'document.upload_failed',
    )
  })

  it('fails clearly before touching the database when R2 is not configured', async () => {
    r2Mock.isR2Configured.mockReturnValue(false)

    await expect(storeDocument(baseInput)).rejects.toMatchObject({ statusCode: 503 })
    expect(prismaMock.storedDocument.create).not.toHaveBeenCalled()
    expect(r2Mock.putR2Object).not.toHaveBeenCalled()
  })

  it('resolves a duplicate-content race in favour of the existing row', async () => {
    const existing = availableDocument({ id: 'doc-winner' })
    prismaMock.storedDocument.update.mockRejectedValueOnce({ code: 'P2002' })
    prismaMock.storedDocument.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(existing)

    const result = await storeDocument(baseInput)

    expect(result.reused).toBe(true)
    expect(result.document).toEqual(existing)
    expect(r2Mock.deleteR2Object).toHaveBeenCalledWith('pupils/p-1/profile/doc-1.jpg')
    expect(prismaMock.storedDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } })
  })
})

describe('issueDocumentUrl', () => {
  it('returns a short-lived presigned URL and audits document downloads', async () => {
    const document = availableDocument()

    const issued = await issueDocumentUrl(document, {
      audit: { actorUserId: 'user-1', ip: '127.0.0.1' },
    })

    expect(issued.url).toBe('https://r2.test/presigned?sig=abc')
    expect(issued.expiresInSeconds).toBe(300)
    expect(issued.documentId).toBe('doc-1')
    expect(r2Mock.getPresignedR2Url).toHaveBeenCalledWith(
      'admissions/p-1/2026/doc-1.pdf',
      expect.objectContaining({ downloadFileName: 'Admission-Form.pdf' }),
    )
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe('document.download')
  })

  it('skips the audit entry for high-frequency avatar reads', async () => {
    await issueDocumentUrl(availableDocument({ documentType: 'PROFILE_PHOTO' }))
    expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
  })

  it('refuses to sign a document that is not AVAILABLE', async () => {
    await expect(
      issueDocumentUrl(availableDocument({ status: 'UPLOADING' })),
    ).rejects.toMatchObject({ statusCode: 409 })
    expect(r2Mock.getPresignedR2Url).not.toHaveBeenCalled()
  })

  it('fails clearly when object storage is not configured', async () => {
    r2Mock.isR2Configured.mockReturnValue(false)
    await expect(issueDocumentUrl(availableDocument())).rejects.toMatchObject({ statusCode: 503 })
    expect(r2Mock.getPresignedR2Url).not.toHaveBeenCalled()
  })
})

describe('removeStoredDocument', () => {
  it('deletes the object, the metadata row and records an audit entry', async () => {
    const document = availableDocument({ documentType: 'PROFILE_PHOTO' })

    await removeStoredDocument(document, {
      actorUserId: 'user-1',
      action: 'profile.picture_delete',
      resourceType: 'user',
      resourceId: 'u-1',
    })

    expect(r2Mock.deleteR2Object).toHaveBeenCalledWith('admissions/p-1/2026/doc-1.pdf')
    expect(prismaMock.storedDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } })
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe('profile.picture_delete')
  })

  it('keeps the metadata row and audits when the object delete fails', async () => {
    r2Mock.deleteR2Object.mockRejectedValue(new AppError('Object storage delete failed.', 503))
    const document = availableDocument()

    await expect(
      removeStoredDocument(document, { actorUserId: 'user-1', action: 'document.delete' }),
    ).rejects.toMatchObject({ statusCode: 503 })

    expect(prismaMock.storedDocument.delete).not.toHaveBeenCalled()
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe('document.delete_failed')
  })
})

describe('supersedeOlderAdmissionForms', () => {
  it('marks other copies SUPERSEDED without deleting anything', async () => {
    await supersedeOlderAdmissionForms({
      pupilId: 'p-1',
      academicYearId: 'year-1',
      keepDocumentId: 'doc-1',
    })

    expect(prismaMock.storedDocument.updateMany).toHaveBeenCalledWith({
      where: {
        documentType: 'ADMISSION_FORM',
        status: 'AVAILABLE',
        pupilId: 'p-1',
        academicYearId: 'year-1',
        id: { not: 'doc-1' },
      },
      data: { status: 'SUPERSEDED' },
    })
    expect(prismaMock.storedDocument.delete).not.toHaveBeenCalled()
  })
})
