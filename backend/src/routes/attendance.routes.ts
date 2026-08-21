import { Router } from 'express'
import {
  createAttendanceHandler,
  getAttendanceHandler,
  listAttendanceHandler,
  updateAttendanceHandler,
  checkInStaffHandler,
  getStaffTodayAttendanceHandler,
  listAttendanceRecordsAdminHandler,
} from '../controllers/attendance.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'

const router = Router()

router.use(requireAuth)

router.get(
  '/',
  requirePermission('attendance.view'),
  listAttendanceHandler,
)
router.post(
  '/',
  requirePermission('attendance.manage'),
  createAttendanceHandler,
)
router.post(
  '/check-in',
  requirePermission('attendance.checkin'),
  checkInStaffHandler,
)
router.get(
  '/:id',
  requirePermission('attendance.view'),
  getAttendanceHandler,
)
router.patch(
  '/:id',
  requirePermission('attendance.manage'),
  updateAttendanceHandler,
)

// Headteacher/Owner can view today's attendance for their staff
router.get(
  '/today/me',
  requireAuth,
  getStaffTodayAttendanceHandler,
)

// Admin can list attendance records
router.get(
  '/admin',
  requirePermission('attendance.manage'),
  listAttendanceRecordsAdminHandler,
)

export const attendanceRouter = router