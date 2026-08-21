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
import {
  checkInStaffHandler,
  getStaffTodayAttendanceHandler,
  listAttendanceRecordsAdminHandler,
} from '../controllers/attendance.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import { validate } from '../middleware/validate'
import { roleAssignSchema, staffCreateSchema, staffUpdateSchema, staffCheckInSchema } from '../schemas'

const router = Router()

router.use(requireAuth)

router.get('/', requirePermission('staff.view'), listStaffHandler)
router.post('/', requirePermission('staff.create'), validate(staffCreateSchema), createStaffHandler)
router.get('/stats', requirePermission('staff.view'), staffStatsHandler)

// Admin attendance listing — placed BEFORE /:id to avoid route conflicts
router.get(
  '/admin',
  requirePermission('attendance.manage'),
  listAttendanceRecordsAdminHandler,
)

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

// GPS Staff Attendance Check-In
router.post(
  '/:id/check-in',
  requirePermission('attendance.checkin'),
  validate(staffCheckInSchema),
  checkInStaffHandler,
)
router.get(
  '/:id/today-attendance',
  getStaffTodayAttendanceHandler,
)

export const staffRouter = router
