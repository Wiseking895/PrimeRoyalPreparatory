import { beforeEach, describe, expect, it, vi } from 'vitest'

const r2Mock = vi.hoisted(() => ({
  isR2Configured: vi.fn(() => true),
  putR2Object: vi.fn(),
  deleteR2Object: vi.fn(),
  getPresignedR2Url: vi.fn(),
  checkR2Health: vi.fn(),
  r2NotConfiguredError: vi.fn(),
}))

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn(), update: vi.fn() },
  pupil: { findUnique: vi.fn(), update: vi.fn() },
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

const fsMock = vi.hoisted(() => ({
  default: {
    mkdir: vi.fn(() => Promise.resolve()),
    writeFile: vi.fn(() => Promise.resolve()),
    unlink: vi.fn(() => Promise.resolve()),
  },
  mkdir: vi.fn(() => Promise.resolve()),
  writeFile: vi.fn(() => Promise.resolve()),
  unlink: vi.fn(() => Promise.resolve()),
}))

vi.mock('../services/r2-storage.service', () => r2Mock)
vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('node:fs/promises', () => fsMock)

import { deleteProfilePicture, deletePupilPicture, uploadPupilPicture, uploadProfilePicture } from './upload.service'

function multerFile(overrides: Record<string, unknown> = {}): Express.Multer.File {
  return {
    fieldname: 'image',
    originalname: 'photo.jpg',
    encoding: '7bit',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('image-bytes'),
    size: Buffer.from('image-bytes').byteLength,
    ...overrides,
  } as Express.Multer.File
}

function userRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    fullName: 'Kofi Mensah',
    email: 'kofi@school.edu',
    status: 'ACTIVE',
    profilePictureUrl: null,
    ...overrides,
  }
}

function pupilRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    pupilId: 'PRPS-PUP-0001',
    firstName: 'Ama',
    lastName: 'Owusu',
    status: 'ACTIVE',
    profilePictureUrl: null,
    ...overrides,
  }
}

function storedPhoto(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    documentType: 'PROFILE_PHOTO',
    storageProvider: 'r2',
    storageKey: 'staff/user-1/profile/doc-1.jpg',
    originalFileName: 'photo.jpg',
    mimeType: 'image/jpeg',
    fileSize: 11,
    sha256: 'a'.repeat(64),
    status: 'AVAILABLE',
    pupilId: null,
    userId: 'user-1',
    academicYearId: null,
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
  r2Mock.isR2Configured.mockReturnValue(true)
  r2Mock.putR2Object.mockResolvedValue(undefined)
  r2Mock.deleteR2Object.mockResolvedValue(undefined)
  fsMock.default.unlink.mockResolvedValue(undefined)
  prismaMock.storedDocument.findFirst.mockResolvedValue(null)
  prismaMock.storedDocument.findUnique.mockResolvedValue(null)
  prismaMock.storedDocument.create.mockResolvedValue({ id: 'doc-1' })
  prismaMock.storedDocument.update.mockImplementation(
    async (args: { where: { id: string }; data: Record<string, unknown> }) => ({
      ...storedPhoto(),
      id: args.where.id,
      ...args.data,
    }),
  )
  prismaMock.storedDocument.updateMany.mockResolvedValue({ count: 0 })
  prismaMock.storedDocument.delete.mockResolvedValue({})
  prismaMock.user.update.mockResolvedValue({})
  prismaMock.pupil.update.mockResolvedValue({})
  prismaMock.auditLog.create.mockResolvedValue({})
  prismaMock.user.findUnique.mockResolvedValue(userRow())
  prismaMock.pupil.findUnique.mockResolvedValue(pupilRow())
})

describe('uploadProfilePicture', () => {
  it('stores the picture in object storage and returns an internal document reference', async () => {
    const result = await uploadProfilePicture('user-1', multerFile(), '127.0.0.1')

    expect(result.profilePictureUrl).toBe('/api/documents/doc-1')
    expect(r2Mock.putR2Object).toHaveBeenCalledWith(
      expect.objectContaining({
        key: 'staff/user-1/profile/doc-1.jpg',
        contentType: 'image/jpeg',
      }),
    )
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { profilePictureUrl: '/api/documents/doc-1' },
    })
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe('profile.picture_upload')
    // No local file is written any more.
    expect(fsMock.default.writeFile).not.toHaveBeenCalled()
  })

  it('removes the previous stored picture once the new one is in place', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      userRow({ profilePictureUrl: '/api/documents/doc-0' }),
    )
    prismaMock.storedDocument.findUnique.mockResolvedValue(
      storedPhoto({ id: 'doc-0', storageKey: 'staff/user-1/profile/doc-0.jpg' }),
    )

    await uploadProfilePicture('user-1', multerFile())

    expect(r2Mock.deleteR2Object).toHaveBeenCalledWith('staff/user-1/profile/doc-0.jpg')
    expect(prismaMock.storedDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-0' } })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { profilePictureUrl: '/api/documents/doc-1' },
    })
  })

  it('still removes legacy local files for pictures uploaded before object storage', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      userRow({ profilePictureUrl: '/api/uploads/profile-pictures/legacy.jpg' }),
    )

    await uploadProfilePicture('user-1', multerFile())

    expect(fsMock.default.unlink).toHaveBeenCalled()
    expect(r2Mock.deleteR2Object).not.toHaveBeenCalled()
    expect(prismaMock.storedDocument.delete).not.toHaveBeenCalled()
  })

  it('rejects unsupported file types before touching storage', async () => {
    await expect(
      uploadProfilePicture('user-1', multerFile({ mimetype: 'application/pdf' })),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(r2Mock.putR2Object).not.toHaveBeenCalled()
  })

  it('rejects files above the 5 MB limit', async () => {
    await expect(
      uploadProfilePicture('user-1', multerFile({ size: 6 * 1024 * 1024 })),
    ).rejects.toMatchObject({ statusCode: 400 })
    expect(r2Mock.putR2Object).not.toHaveBeenCalled()
  })

  it('fails clearly when object storage is not configured', async () => {
    r2Mock.isR2Configured.mockReturnValue(false)

    await expect(uploadProfilePicture('user-1', multerFile())).rejects.toMatchObject({
      statusCode: 503,
    })
    expect(prismaMock.storedDocument.create).not.toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })
})

describe('deleteProfilePicture', () => {
  it('deletes the object and metadata row, then clears the reference', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      userRow({ profilePictureUrl: '/api/documents/doc-1' }),
    )
    prismaMock.storedDocument.findUnique.mockResolvedValue(storedPhoto())

    await deleteProfilePicture('user-1', '127.0.0.1')

    expect(r2Mock.deleteR2Object).toHaveBeenCalledWith('staff/user-1/profile/doc-1.jpg')
    expect(prismaMock.storedDocument.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { profilePictureUrl: null },
    })
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe('profile.picture_delete')
    // One audit entry only (the storage layer already recorded the deletion).
    expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1)
  })

  it('deletes legacy local files and audits', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      userRow({ profilePictureUrl: '/api/uploads/profile-pictures/legacy.jpg' }),
    )

    await deleteProfilePicture('user-1')

    expect(fsMock.default.unlink).toHaveBeenCalled()
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { profilePictureUrl: null },
    })
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe('profile.picture_delete')
  })
})

describe('uploadPupilPicture', () => {
  it('stores pupil photos under the pupil prefix and updates the pupil record', async () => {
    const result = await uploadPupilPicture('user-1', 'p-1', multerFile(), '127.0.0.1')

    expect(result.profilePictureUrl).toBe('/api/documents/doc-1')
    expect(r2Mock.putR2Object.mock.calls[0][0].key).toBe('pupils/p-1/profile/doc-1.jpg')
    expect(prismaMock.pupil.update).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      data: { profilePictureUrl: '/api/documents/doc-1' },
    })
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe('pupil.picture_upload')
  })

  it('returns 404 when the pupil does not exist', async () => {
    prismaMock.pupil.findUnique.mockResolvedValue(null)
    await expect(uploadPupilPicture('user-1', 'missing', multerFile())).rejects.toMatchObject({
      statusCode: 404,
    })
    expect(r2Mock.putR2Object).not.toHaveBeenCalled()
  })
})

describe('deletePupilPicture', () => {
  it('deletes the stored object and clears the pupil reference', async () => {
    prismaMock.pupil.findUnique.mockResolvedValue(
      pupilRow({ profilePictureUrl: '/api/documents/doc-1' }),
    )
    prismaMock.storedDocument.findUnique.mockResolvedValue(
      storedPhoto({ pupilId: 'p-1', userId: null, storageKey: 'pupils/p-1/profile/doc-1.jpg' }),
    )

    await deletePupilPicture('user-1', 'p-1')

    expect(r2Mock.deleteR2Object).toHaveBeenCalledWith('pupils/p-1/profile/doc-1.jpg')
    expect(prismaMock.pupil.update).toHaveBeenCalledWith({
      where: { id: 'p-1' },
      data: { profilePictureUrl: null },
    })
    expect(prismaMock.auditLog.create.mock.calls[0][0].data.action).toBe('pupil.picture_delete')
  })
})
