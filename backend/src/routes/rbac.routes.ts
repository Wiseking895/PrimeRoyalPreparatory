import { Router } from 'express'
import { listPermissionsHandler, listRolesHandler } from '../controllers/rbac.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'

const router = Router()

router.get('/roles', requireAuth, listRolesHandler)
router.get(
  '/permissions',
  requireAuth,
  requirePermission('owner.manage', 'staff.assign_role'),
  listPermissionsHandler,
)

export const rbacRouter = router