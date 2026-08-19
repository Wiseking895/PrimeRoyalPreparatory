import { Router } from 'express'
import {
  activateStaffHandler,
  assignRoleHandler,
  createStaffHandler,
  deactivateStaffHandler,
  getStaffHandler,
  listStaffHandler,
  removeRoleHandler,
  resendStaffInvitationHandler,
  staffStatsHandler,
  updateStaffHandler,
} from '../controllers/staff.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import { validate } from '../middleware/validate'
import { roleAssignSchema, staffCreateSchema, staffUpdateSchema } from '../schemas'

const router = Router()

router.use(requireAuth)

router.get('/', requirePermission('staff.view'), listStaffHandler)
router.post('/', requirePermission('staff.create'), validate(staffCreateSchema), createStaffHandler)
router.get('/stats', requirePermission('staff.view'), staffStatsHandler)
router.get('/:id', requirePermission('staff.view'), getStaffHandler)
router.patch('/:id', requirePermission('staff.update'), validate(staffUpdateSchema), updateStaffHandler)
router.post('/:id/resend-invitation', requirePermission('staff.update'), resendStaffInvitationHandler)
router.post('/:id/activate', requirePermission('staff.update'), activateStaffHandler)
router.post('/:id/deactivate', requirePermission('staff.update'), deactivateStaffHandler)
router.put(
  '/:id/role',
  requirePermission('staff.assign_role'),
  validate(roleAssignSchema),
  assignRoleHandler,
)
router.delete('/:id/role', requirePermission('staff.remove_role'), removeRoleHandler)

export const staffRouter = router