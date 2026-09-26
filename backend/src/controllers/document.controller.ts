import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest, AuthenticatedUser, ParentRequest } from '../types/auth'
import { AppError } from '../utils/app-error'
import { asyncHandler } from '../utils/async-handler'
import {
  getStoredDocument,
  issueDocumentUrl,
} from '../services/document-storage.service'
import { checkR2Health } from '../services/r2-storage.service'
import { assertGuardianOwnsPupil } from '../services/parent-portal.service'
import type { StoredDocument } from '@prisma/client'

/**
 * Staff-side document access. There is deliberately no route that streams an
 * object directly: callers only ever receive a short-lived presigned URL after
 * the checks below, and no object key or credential leaves the backend.
 */

function canViewDocument(user: AuthenticatedUser, document: StoredDocument): boolean {
  const has = (permission: string) => user.permissionKeys.includes(permission)

  switch (document.documentType) {
    case 'ADMISSION_FORM':
      // Same permission as the admission-form download route.
      return has('pupils.view')
    case 'PROFILE_PHOTO':
      if (document.pupilId) return has('pupils.view')
      // Staff photos: the account holder themselves, or anyone who may view staff.
      if (document.userId) return document.userId === user.id || has('staff.view')
      return false
    default:
      return false
  }
}

export const getDocumentUrlHandler = asyncHandler(async (req: AuthRequest, res) => {
  const user = req.user!
  const document = await getStoredDocument(req.params.documentId)

  if (!canViewDocument(user, document)) {
    throw new AppError(
      'Forbidden: you do not have permission to view this document.',
      HttpStatus.Forbidden,
    )
  }

  const issued = await issueDocumentUrl(document, {
    // Audit generated documents; avatars are intentionally not audited on read
    // to keep the audit log free of one entry per page view.
    audit:
      document.documentType === 'ADMISSION_FORM'
        ? { actorUserId: user.id, ip: req.ip }
        : undefined,
  })

  res.json(ok(issued))
})

/**
 * Parent-portal document access: only documents linked to a pupil the
 * guardian actually belongs to, and only the two document types PRPS issues
 * today. Guardians never reach staff documents.
 */
export const parentGetDocumentUrlHandler = asyncHandler(
  async (req: ParentRequest, res) => {
    const parent = req.parent!
    const document = await getStoredDocument(req.params.documentId)

    if (!document.pupilId) {
      // Do not reveal the existence of staff/global documents.
      throw new AppError('Document not found.', HttpStatus.NotFound)
    }
    if (
      document.documentType !== 'ADMISSION_FORM' &&
      document.documentType !== 'PROFILE_PHOTO'
    ) {
      throw new AppError('Document not found.', HttpStatus.NotFound)
    }

    await assertGuardianOwnsPupil(parent.id, document.pupilId)

    const issued = await issueDocumentUrl(document, {
      audit:
        document.documentType === 'ADMISSION_FORM'
          ? // Guardians are not staff users: audit without an actor FK.
            { actorUserId: null, ip: req.ip }
          : undefined,
    })

    res.json(ok(issued))
  },
)

/**
 * Storage health probe for operators. Requires authentication plus
 * `owner.manage`, and never exposes credentials — only configuration state,
 * bucket name, endpoint host and reachability.
 */
export const getStorageHealthHandler = asyncHandler(async (_req, res) => {
  const health = await checkR2Health()
  res.json(ok(health))
})
