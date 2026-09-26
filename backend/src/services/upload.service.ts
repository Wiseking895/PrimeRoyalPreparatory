import path from 'node:path'
import fs from 'node:fs/promises'
import { HttpStatus } from '../config/enums'
import { prisma } from '../lib/prisma'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import {
  buildPupilProfileKey,
  buildStaffProfileKey,
  documentReference,
  findDocumentForReference,
  isDocumentReference,
  removeStoredDocument,
  storeDocument,
} from './document-storage.service'

/**
 * Profile pictures are stored as private objects in Cloudflare R2 (via the
 * document-storage service). The database keeps the metadata row and the
 * subject's `profilePictureUrl` points at the internal reference
 * `/api/documents/{documentId}`; the frontend resolves that to a short-lived
 * presigned URL after RBAC checks.
 *
 * Pictures uploaded before this change (files under `uploads/`) keep working:
 * they are still served by the legacy static mount and are removed with the
 * same filesystem delete as before. No local file is ever written for new
 * uploads — when R2 is not configured the upload fails with a clear 503.
 */

const USER_UPLOAD_DIR = path.resolve('uploads/profile-pictures')
const PUPIL_UPLOAD_DIR = path.resolve('uploads/pupil-pictures')

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
])

const MAX_FILE_SIZE = 5 * 1024 * 1024

const EXT_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

export interface UploadResult {
  profilePictureUrl: string
}

function validateFile(file: Express.Multer.File): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new AppError('Only JPEG, PNG, WebP and GIF images are allowed.', HttpStatus.BadRequest)
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new AppError('Image must be smaller than 5 MB.', HttpStatus.BadRequest)
  }
}

function extensionFor(file: Express.Multer.File): string {
  return EXT_MAP[file.mimetype] ?? '.jpg'
}

/**
 * Removes whatever the subject's previous picture was: an R2 document row or
 * a legacy local file. Best effort — a failure is logged/audited but never
 * fails the new upload (mirrors the old `.catch(() => {})` behaviour).
 */
async function removePreviousPicture(
  previousUrl: string,
  options: {
    actorUserId: string
    ip?: string | null
    action: string
    resourceType: 'user' | 'pupil'
    resourceId: string
    legacyDir: string
  },
): Promise<void> {
  if (!previousUrl) return

  if (isDocumentReference(previousUrl)) {
    const document = await findDocumentForReference(previousUrl)
    if (!document) return
    try {
      await removeStoredDocument(document, {
        actorUserId: options.actorUserId,
        ip: options.ip ?? null,
        action: options.action,
        resourceType: options.resourceType,
        resourceId: options.resourceId,
      })
    } catch (error) {
      // Already audited by removeStoredDocument; keep the request successful.
      void error
    }
    return
  }

  if (previousUrl.startsWith('/api/uploads/')) {
    const filename = previousUrl.split('/').pop()
    if (filename) {
      const oldPath = path.join(options.legacyDir, filename)
      await fs.unlink(oldPath).catch(() => {})
    }
  }
}

export async function uploadProfilePicture(
  userId: string,
  file: Express.Multer.File,
  ip?: string,
): Promise<UploadResult> {
  validateFile(file)

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError('Account not found.', HttpStatus.NotFound)
  }

  const ext = extensionFor(file)
  const { document } = await storeDocument({
    documentType: 'PROFILE_PHOTO',
    buildKey: (documentId) => buildStaffProfileKey(userId, documentId, ext),
    body: file.buffer,
    mimeType: file.mimetype,
    originalFileName: file.originalname?.trim() || null,
    userId,
    actorUserId: userId,
    audit: {
      action: 'profile.picture_upload',
      resourceType: 'user',
      resourceId: userId,
      ip: ip ?? null,
    },
  })

  const url = documentReference(document.id)

  await prisma.user.update({
    where: { id: userId },
    data: { profilePictureUrl: url },
  })

  if (user.profilePictureUrl && user.profilePictureUrl !== url) {
    await removePreviousPicture(user.profilePictureUrl, {
      actorUserId: userId,
      ip: ip ?? null,
      action: 'profile.picture_replaced',
      resourceType: 'user',
      resourceId: userId,
      legacyDir: USER_UPLOAD_DIR,
    })
  }

  return { profilePictureUrl: url }
}

export async function deleteProfilePicture(
  userId: string,
  ip?: string,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError('Account not found.', HttpStatus.NotFound)
  }

  let auditedByStorageLayer = false

  if (user.profilePictureUrl) {
    if (isDocumentReference(user.profilePictureUrl)) {
      const document = await findDocumentForReference(user.profilePictureUrl)
      if (document) {
        await removeStoredDocument(document, {
          actorUserId: userId,
          ip: ip ?? null,
          action: 'profile.picture_delete',
          resourceType: 'user',
          resourceId: userId,
        })
        auditedByStorageLayer = true
      }
    } else if (user.profilePictureUrl.startsWith('/api/uploads/')) {
      const filename = user.profilePictureUrl.split('/').pop()
      if (filename) {
        const filePath = path.join(USER_UPLOAD_DIR, filename)
        await fs.unlink(filePath).catch(() => {})
      }
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { profilePictureUrl: null },
  })

  if (!auditedByStorageLayer) {
    await recordAudit({
      actorUserId: userId,
      action: 'profile.picture_delete',
      resourceType: 'user',
      resourceId: userId,
      ip: ip ?? null,
    })
  }
}

export async function uploadPupilPicture(
  actorUserId: string,
  pupilId: string,
  file: Express.Multer.File,
  ip?: string,
): Promise<UploadResult> {
  validateFile(file)

  const pupil = await prisma.pupil.findUnique({ where: { id: pupilId } })
  if (!pupil) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }

  const ext = extensionFor(file)
  const { document } = await storeDocument({
    documentType: 'PROFILE_PHOTO',
    buildKey: (documentId) => buildPupilProfileKey(pupilId, documentId, ext),
    body: file.buffer,
    mimeType: file.mimetype,
    originalFileName: file.originalname?.trim() || null,
    pupilId,
    actorUserId,
    audit: {
      action: 'pupil.picture_upload',
      resourceType: 'pupil',
      resourceId: pupilId,
      ip: ip ?? null,
    },
  })

  const url = documentReference(document.id)

  await prisma.pupil.update({
    where: { id: pupilId },
    data: { profilePictureUrl: url },
  })

  if (pupil.profilePictureUrl && pupil.profilePictureUrl !== url) {
    await removePreviousPicture(pupil.profilePictureUrl, {
      actorUserId,
      ip: ip ?? null,
      action: 'pupil.picture_replaced',
      resourceType: 'pupil',
      resourceId: pupilId,
      legacyDir: PUPIL_UPLOAD_DIR,
    })
  }

  return { profilePictureUrl: url }
}

export async function deletePupilPicture(
  actorUserId: string,
  pupilId: string,
  ip?: string,
): Promise<void> {
  const pupil = await prisma.pupil.findUnique({ where: { id: pupilId } })
  if (!pupil) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }

  let auditedByStorageLayer = false

  if (pupil.profilePictureUrl) {
    if (isDocumentReference(pupil.profilePictureUrl)) {
      const document = await findDocumentForReference(pupil.profilePictureUrl)
      if (document) {
        await removeStoredDocument(document, {
          actorUserId,
          ip: ip ?? null,
          action: 'pupil.picture_delete',
          resourceType: 'pupil',
          resourceId: pupilId,
        })
        auditedByStorageLayer = true
      }
    } else if (pupil.profilePictureUrl.startsWith('/api/uploads/')) {
      const filename = pupil.profilePictureUrl.split('/').pop()
      if (filename) {
        const filePath = path.join(PUPIL_UPLOAD_DIR, filename)
        await fs.unlink(filePath).catch(() => {})
      }
    }
  }

  await prisma.pupil.update({
    where: { id: pupilId },
    data: { profilePictureUrl: null },
  })

  if (!auditedByStorageLayer) {
    await recordAudit({
      actorUserId,
      action: 'pupil.picture_delete',
      resourceType: 'pupil',
      resourceId: pupilId,
      ip: ip ?? null,
    })
  }
}
