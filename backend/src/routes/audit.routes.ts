import { Router } from 'express'
import { listAuditHandler } from '../controllers/audit.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'

const router = Router()

router.use(requireAuth)
router.get('/', requirePermission('audit.view'), listAuditHandler)

export const auditRouter = router