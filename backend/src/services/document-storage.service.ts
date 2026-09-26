import crypto from 'node:crypto'
import type { StoredDocument, StoredDocumentType } from '@prisma/client'
import { HttpStatus } from '../config/enums'
import { prisma } from '../lib/prisma'
import { sha256Hex } from '../lib/hash'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import { env } from '../config/env'
import { logger } from '../config/logger'
import {
  getPresignedR2Url,
  isR2Configured,
  putR2Object,
  deleteR2Object,
} from './r2-storage.service'

/**
 * Document metadata + object lifecycle on top of Cloudflare R2.
 *
 * Rules enforced here (see the object-storage spec):
 *  - PostgreSQL is the source of truth. Every object has exactly one
 *    StoredDocument row; only the object KEY is stored — never a presigned URL.
 *  - Rows are created as UPLOADING and only become AVAILABLE after the R2
 *    write succeeds, so the database can never claim success for a missing
 *    object. Failures become FAILED rows plus an audit entry.
 *  - Uploads are deduplicated by SHA-256 so identical content is stored once.
 *  - Deleting never removes source data elsewhere: it only removes the object
 *    copy and its metadata row (or marks older versions SUPERSEDED).
 */

/** Internal, token-protected reference stored in profilePictureUrl. */
export const DOCUMENT_REFERENCE_PREFIX = '/api/documents/'

export function documentReference(documentId: string): string {
  return `${DOCUMENT_REFERENCE_PREFIX}${documentId}`
}

export function isDocumentReference(url: string | null | undefined): boolean {
  return typeof url === 'string' && url.startsWith(DOCUMENT_REFERENCE_PREFIX)
}

export function documentIdFromReference(url: string): string {
  return url.slice(DOCUMENT_REFERENCE_PREFIX.length)
}

// ---------------------------------------------------------------------------
// Object key layout (private bucket, immutable id-based keys)
// ---------------------------------------------------------------------------

const UNSCOPED = 'unscoped'

/** `admissions/{pupilId}/{academicYearId|unscoped}/{documentId}.pdf` */
export function buildAdmissionFormKey(
  pupilId: string,
  academicYearId: string | null,
  documentId: string,
): string {
  return `admissions/${pupilId}/${academicYearId ?? UNSCOPED}/${documentId}.pdf`
}

/** `pupils/{pupilId}/profile/{documentId}{ext}` */
export function buildPupilProfileKey(pupilId: string, documentId: string, ext: string): string {
  return `pupils/${pupilId}/profile/${documentId}${normalizeExt(ext)}`
}

/** `staff/{userId}/profile/{documentId}{ext}` */
export function buildStaffProfileKey(userId: string, documentId: string, ext: string): string {
  return `staff/${userId}/profile/${documentId}${normalizeExt(ext)}`
}

function normalizeExt(ext: string): string {
  if (!ext) return ''
  return ext.startsWith('.') ? ext : `.${ext}`
}

// ---------------------------------------------------------------------------
// Integrity
// ---------------------------------------------------------------------------

export { sha256Hex }

function assertR2(): void {
  if (!isR2Configured()) {
    // Clear, actionable failure — never a silent fallback to local disk.
    throw new AppError(
      `Object storage (Cloudflare R2) is not configured. Set R2_ENDPOINT, R2_BUCKET_NAME, ` +
        `R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY in backend/.env (see .env.example).`,
      HttpStatus.ServiceUnavailable,
    )
  }
}

// ---------------------------------------------------------------------------
// Persisting new documents
// ---------------------------------------------------------------------------

export interface StoreDocumentInput {
  documentType: StoredDocumentType
  /**
   * Builds the final object key once the metadata row exists, e.g.
   * `(id) => buildAdmissionFormKey(pupilId, sessionId, id)`.
   */
  buildKey: (documentId: string) => string
  body: Buffer
  mimeType: string
  originalFileName?: string | null
  /** Business linkage. */
  pupilId?: string | null
  userId?: string | null
  academicYearId?: string | null
  termId?: string | null
  /** Staff user who triggered the operation (nullable for system flows). */
  actorUserId?: string | null
  /** Audit entry recorded on success; omit to keep the caller's own audit. */
  audit?: {
    action: string
    resourceType?: string
    resourceId?: string
    ip?: string | null
  }
}

export interface StoreDocumentResult {
  document: StoredDocument
  /** True when identical content already existed and no new object was written. */
  reused: boolean
}

/**
 * Stores one document: dedupe by hash, create UPLOADING row, write to R2,
 * flip to AVAILABLE. On any failure the row becomes FAILED (with an audit
 * entry) and the original error is rethrown — PostgreSQL never claims success
 * for an object that does not exist.
 */
export async function storeDocument(input: StoreDocumentInput): Promise<StoreDocumentResult> {
  assertR2()

  const sha256 = sha256Hex(input.body)

  const existing = await findExistingDocument({
    documentType: input.documentType,
    pupilId: input.pupilId ?? null,
    academicYearId: input.academicYearId ?? null,
    userId: input.userId ?? null,
    sha256,
  })
  if (existing) {
    if (input.audit) {
      await recordAudit({
        actorUserId: input.actorUserId ?? null,
        action: `${input.audit.action}_reused`,
        resourceType: input.audit.resourceType ?? 'document',
        resourceId: input.audit.resourceId ?? existing.id,
        ip: input.audit.ip ?? null,
        metadata: { documentId: existing.id, sha256 },
      })
    }
    return { document: existing, reused: true }
  }

  const documentId = await createUploadingRow(input, sha256)
  const storageKey = input.buildKey(documentId)

  try {
    await putR2Object({
      key: storageKey,
      body: input.body,
      contentType: input.mimeType,
      metadata: {
        documentType: input.documentType,
        documentId,
        ...(input.pupilId ? { pupilId: input.pupilId } : {}),
        ...(input.userId ? { userId: input.userId } : {}),
      },
    })
  } catch (error) {
    await markFailed(documentId, storageKey)
    await recordAudit({
      actorUserId: input.actorUserId ?? null,
      action: 'document.upload_failed',
      resourceType: input.audit?.resourceType ?? 'document',
      resourceId: input.audit?.resourceId ?? documentId,
      ip: input.audit?.ip ?? null,
      metadata: {
        documentId,
        documentType: input.documentType,
        storageKey,
        reason: error instanceof Error ? error.message : 'storage error',
      },
    })
    throw error
  }

  try {
    const document = await prisma.storedDocument.update({
      where: { id: documentId },
      data: { storageKey, status: 'AVAILABLE' },
    })
    if (input.audit) {
      await recordAudit({
        actorUserId: input.actorUserId ?? null,
        action: input.audit.action,
        resourceType: input.audit.resourceType ?? 'document',
        resourceId: input.audit.resourceId ?? documentId,
        ip: input.audit.ip ?? null,
        metadata: { documentId, storageKey, sha256, size: input.body.byteLength },
      })
    }
    return { document, reused: false }
  } catch (error) {
    // Unique-content race: another request stored identical bytes first.
    if (isUniqueViolation(error)) {
      await deleteObjectBestEffort(storageKey, documentId)
      await prisma.storedDocument.delete({ where: { id: documentId } }).catch(() => {})
      const winner = await findExistingDocument({
        documentType: input.documentType,
        pupilId: input.pupilId ?? null,
        academicYearId: input.academicYearId ?? null,
        userId: input.userId ?? null,
        sha256,
      })
      if (winner) return { document: winner, reused: true }
    }
    await markFailed(documentId, storageKey)
    throw error
  }
}

async function createUploadingRow(input: StoreDocumentInput, sha256: string): Promise<string> {
  // The final key needs the row id, so the row is created with a unique
  // placeholder key and rewritten after the object exists.
  const placeholderKey = `pending/${crypto.randomUUID()}`
  try {
    const row = await prisma.storedDocument.create({
      data: {
        documentType: input.documentType,
        storageKey: placeholderKey,
        originalFileName: input.originalFileName ?? null,
        mimeType: input.mimeType,
        fileSize: input.body.byteLength,
        sha256,
        status: 'UPLOADING',
        pupilId: input.pupilId ?? null,
        userId: input.userId ?? null,
        academicYearId: input.academicYearId ?? null,
        termId: input.termId ?? null,
        createdById: input.actorUserId ?? null,
      },
      select: { id: true },
    })
    return row.id
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new AppError('This document has already been stored.', HttpStatus.Conflict)
    }
    throw error
  }
}

async function markFailed(documentId: string, storageKey: string): Promise<void> {
  await prisma.storedDocument
    .update({
      where: { id: documentId },
      data: { storageKey, status: 'FAILED' },
    })
    .catch((error: unknown) => {
      logger.error(
        { event: 'document.mark_failed_failed', documentId, reason: String(error) },
        'Could not mark stored document as FAILED',
      )
    })
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: string })?.code
  return code === 'P2002'
}

/** Latest AVAILABLE copy of the same content for the same subject, if any. */
export async function findExistingDocument(filter: {
  documentType: StoredDocumentType
  pupilId: string | null
  academicYearId: string | null
  userId: string | null
  sha256: string
}): Promise<StoredDocument | null> {
  return prisma.storedDocument.findFirst({
    where: {
      documentType: filter.documentType,
      status: 'AVAILABLE',
      sha256: filter.sha256,
      // Prisma treats null relation filters as "IS NULL" on the column pair.
      pupilId: filter.pupilId,
      academicYearId: filter.academicYearId,
      userId: filter.userId,
    },
    orderBy: { createdAt: 'desc' },
  })
}

// ---------------------------------------------------------------------------
// Serving documents
// ---------------------------------------------------------------------------

export interface IssuedDocumentUrl {
  documentId: string
  url: string
  expiresInSeconds: number
  mimeType: string
  fileName: string | null
  sha256: string
}

/**
 * Issues a short-lived presigned GET URL for an AVAILABLE document. The URL
 * is treated as a bearer token: callers must have completed RBAC first and
 * must never persist it.
 */
export async function issueDocumentUrl(
  document: StoredDocument,
  options: {
    downloadFileName?: string
    /** Record a `document.download` audit entry (off for high-frequency avatars). */
    audit?: { actorUserId: string | null; ip?: string | null }
  } = {},
): Promise<IssuedDocumentUrl> {
  assertR2()
  if (document.status !== 'AVAILABLE') {
    throw new AppError('This document is not available yet.', HttpStatus.Conflict)
  }

  const url = await getPresignedR2Url(document.storageKey, {
    downloadFileName: options.downloadFileName ?? document.originalFileName ?? undefined,
  })

  if (options.audit) {
    await recordAudit({
      actorUserId: options.audit.actorUserId,
      action: 'document.download',
      resourceType: 'document',
      resourceId: document.id,
      ip: options.audit.ip ?? null,
      metadata: {
        documentType: document.documentType,
        storageKey: document.storageKey,
        pupilId: document.pupilId,
        userId: document.userId,
      },
    })
  }

  return {
    documentId: document.id,
    url,
    expiresInSeconds: env.r2PresignExpiresInSeconds,
    mimeType: document.mimeType,
    fileName: document.originalFileName,
    sha256: document.sha256,
  }
}

export async function getStoredDocument(documentId: string): Promise<StoredDocument> {
  const document = await prisma.storedDocument.findUnique({ where: { id: documentId } })
  if (!document) {
    throw new AppError('Document not found.', HttpStatus.NotFound)
  }
  return document
}

// ---------------------------------------------------------------------------
// Superseding / deleting
// ---------------------------------------------------------------------------

/**
 * Marks older admission-form versions of the same pupil+session SUPERSEDED
 * (kept, never deleted) so history stays intact and only the latest copy is
 * offered.
 */
export async function supersedeOlderAdmissionForms(input: {
  pupilId: string
  academicYearId: string | null
  keepDocumentId: string
}): Promise<void> {
  await prisma.storedDocument.updateMany({
    where: {
      documentType: 'ADMISSION_FORM',
      status: 'AVAILABLE',
      pupilId: input.pupilId,
      academicYearId: input.academicYearId,
      id: { not: input.keepDocumentId },
    },
    data: { status: 'SUPERSEDED' },
  })
}

export interface RemoveDocumentOptions {
  actorUserId: string | null
  ip?: string | null
  /** Audit action recorded after a successful removal. */
  action: string
  resourceType?: string
  resourceId?: string
}

/**
 * Deletes the object copy and its metadata row. Object deletion is
 * best-effort: if storage is briefly unavailable the row is kept (still the
 * source of truth) and the failure is logged, so no dangling reference is
 * created on the subject record.
 */
export async function removeStoredDocument(
  document: StoredDocument,
  options: RemoveDocumentOptions,
): Promise<void> {
  try {
    await deleteR2Object(document.storageKey)
  } catch (error) {
    await recordAudit({
      actorUserId: options.actorUserId,
      action: 'document.delete_failed',
      resourceType: options.resourceType ?? 'document',
      resourceId: options.resourceId ?? document.id,
      ip: options.ip ?? null,
      metadata: {
        documentId: document.id,
        storageKey: document.storageKey,
        reason: error instanceof Error ? error.message : 'storage error',
      },
    })
    logger.error(
      { event: 'document.delete_failed', documentId: document.id, storageKey: document.storageKey },
      'Object deletion failed; metadata row kept',
    )
    throw error
  }

  await prisma.storedDocument.delete({ where: { id: document.id } }).catch((error: unknown) => {
    logger.error(
      { event: 'document.metadata_delete_failed', documentId: document.id, reason: String(error) },
      'Could not delete stored document metadata row',
    )
  })

  await recordAudit({
    actorUserId: options.actorUserId,
    action: options.action,
    resourceType: options.resourceType ?? 'document',
    resourceId: options.resourceId ?? document.id,
    ip: options.ip ?? null,
    metadata: {
      documentId: document.id,
      storageKey: document.storageKey,
      sha256: document.sha256,
      documentType: document.documentType,
    },
  })
}

async function deleteObjectBestEffort(storageKey: string, documentId: string): Promise<void> {
  try {
    await deleteR2Object(storageKey)
  } catch (error) {
    logger.error(
      {
        event: 'document.orphan_object_delete_failed',
        documentId,
        storageKey,
        reason: String(error),
      },
      'Could not clean up an object after a duplicate-content race',
    )
  }
}

// ---------------------------------------------------------------------------
// Subject helpers (profile pictures)
// ---------------------------------------------------------------------------

/** Latest AVAILABLE profile photo for a staff user, if any. */
export async function findStaffProfilePhoto(userId: string): Promise<StoredDocument | null> {
  return prisma.storedDocument.findFirst({
    where: { documentType: 'PROFILE_PHOTO', userId, status: 'AVAILABLE' },
    orderBy: { createdAt: 'desc' },
  })
}

/** Latest AVAILABLE profile photo for a pupil, if any. */
export async function findPupilProfilePhoto(pupilId: string): Promise<StoredDocument | null> {
  return prisma.storedDocument.findFirst({
    where: { documentType: 'PROFILE_PHOTO', pupilId, status: 'AVAILABLE' },
    orderBy: { createdAt: 'desc' },
  })
}

/** Loads the document referenced by a stored `profilePictureUrl`, if it is one. */
export async function findDocumentForReference(
  url: string | null | undefined,
): Promise<StoredDocument | null> {
  if (!isDocumentReference(url)) return null
  const documentId = documentIdFromReference(url!)
  return prisma.storedDocument.findUnique({ where: { id: documentId } })
}
