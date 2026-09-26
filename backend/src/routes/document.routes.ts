import { Router } from 'express'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import {
  getDocumentUrlHandler,
  getStorageHealthHandler,
} from '../controllers/document.controller'

const router = Router()

/**
 * Document access. Every response is a short-lived presigned URL for a private
 * R2 object, issued only after RBAC checks — object keys and credentials are
 * never returned to the client.
 */
router.get('/documents/:documentId/url', requireAuth, getDocumentUrlHandler)

/**
 * Object storage health (configuration + reachability probe). Owner only.
 */
router.get(
  '/health/storage',
  requireAuth,
  requirePermission('owner.manage'),
  getStorageHealthHandler,
)

export const documentRouter = router
