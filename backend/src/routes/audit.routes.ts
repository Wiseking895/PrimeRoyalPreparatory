import { Router } from 'express'
import { listAuditHandler } from '../controllers/audit.controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requirePermission } from '../middleware/require-permission.js'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('audit.view'), listAuditHandler)

export const auditRouter = router