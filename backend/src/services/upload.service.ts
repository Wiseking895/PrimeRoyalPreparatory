import path from 'node:path'
import fs from 'node:fs/promises'
import { HttpStatus } from '../config/enums'
import { prisma } from '../lib/prisma'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'

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

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true })
}

function validateFile(file: Express.Multer.File): void {
  if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
    throw new AppError('Only JPEG, PNG, WebP and GIF images are allowed.', HttpStatus.BadRequest)
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new AppError('Image must be smaller than 5 MB.', HttpStatus.BadRequest)
  }
}

function publicUrl(filename: string): string {
  return `/api/uploads/profile-pictures/${filename}`
}

export async function uploadProfilePicture(
  userId: string,
  file: Express.Multer.File,
  ip?: string,
): Promise<UploadResult> {
  validateFile(file)
  await ensureDir(USER_UPLOAD_DIR)

  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user) {
    throw new AppError('Account not found.', HttpStatus.NotFound)
  }

  if (user.profilePictureUrl) {
    const oldFilename = user.profilePictureUrl.split('/').pop()
    if (oldFilename) {
      const oldPath = path.join(USER_UPLOAD_DIR, oldFilename)
      await fs.unlink(oldPath).catch(() => {})
    }
  }

  const ext = EXT_MAP[file.mimetype] ?? '.jpg'
  const filename = `${userId}-${Date.now()}${ext}`
  const dest = path.join(USER_UPLOAD_DIR, filename)

  await fs.writeFile(dest, file.buffer)

  const url = publicUrl(filename)

  await prisma.user.update({
    where: { id: userId },
    data: { profilePictureUrl: url },
  })

  await recordAudit({
    actorUserId: userId,
    action: 'profile.picture_upload',
    resourceType: 'user',
    resourceId: userId,
    ip: ip ?? null,
  })

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

  if (user.profilePictureUrl) {
    const filename = user.profilePictureUrl.split('/').pop()
    if (filename) {
      const filePath = path.join(USER_UPLOAD_DIR, filename)
      await fs.unlink(filePath).catch(() => {})
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { profilePictureUrl: null },
  })

  await recordAudit({
    actorUserId: userId,
    action: 'profile.picture_delete',
    resourceType: 'user',
    resourceId: userId,
    ip: ip ?? null,
  })
}

function pupilPublicUrl(filename: string): string {
  return `/api/uploads/pupil-pictures/${filename}`
}

export async function uploadPupilPicture(
  actorUserId: string,
  pupilId: string,
  file: Express.Multer.File,
  ip?: string,
): Promise<UploadResult> {
  validateFile(file)
  await ensureDir(PUPIL_UPLOAD_DIR)

  const pupil = await prisma.pupil.findUnique({ where: { id: pupilId } })
  if (!pupil) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }

  if (pupil.profilePictureUrl) {
    const oldFilename = pupil.profilePictureUrl.split('/').pop()
    if (oldFilename) {
      const oldPath = path.join(PUPIL_UPLOAD_DIR, oldFilename)
      await fs.unlink(oldPath).catch(() => {})
    }
  }

  const ext = EXT_MAP[file.mimetype] ?? '.jpg'
  const filename = `${pupilId}-${Date.now()}${ext}`
  const dest = path.join(PUPIL_UPLOAD_DIR, filename)

  await fs.writeFile(dest, file.buffer)

  const url = pupilPublicUrl(filename)

  await prisma.pupil.update({
    where: { id: pupilId },
    data: { profilePictureUrl: url },
  })

  await recordAudit({
    actorUserId,
    action: 'pupil.picture_upload',
    resourceType: 'pupil',
    resourceId: pupilId,
    ip: ip ?? null,
  })

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

  if (pupil.profilePictureUrl) {
    const filename = pupil.profilePictureUrl.split('/').pop()
    if (filename) {
      const filePath = path.join(PUPIL_UPLOAD_DIR, filename)
      await fs.unlink(filePath).catch(() => {})
    }
  }

  await prisma.pupil.update({
    where: { id: pupilId },
    data: { profilePictureUrl: null },
  })

  await recordAudit({
    actorUserId,
    action: 'pupil.picture_delete',
    resourceType: 'pupil',
    resourceId: pupilId,
    ip: ip ?? null,
  })
}
