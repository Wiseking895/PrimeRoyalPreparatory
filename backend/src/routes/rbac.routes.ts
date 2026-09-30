import { Router } from 'express'
import { listPermissionsHandler, listRolesHandler } from '../controllers/rbac.controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requirePermission } from '../middleware/require-permission.js'

const router = Router()

router.get('/roles', requireAuth, listRolesHandler)
router.get(
  '/permissions',
  requireAuth,
  requirePermission('owner.manage', 'staff.assign_role'),
  listPermissionsHandler,
)

export const rbacRouter = router