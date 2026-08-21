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

// Staff self-service: today's attendance — placed BEFORE /:id to avoid route conflicts
router.get(
  '/today/me',
  getStaffTodayAttendanceHandler,
)

// Admin attendance listing — placed BEFORE /:id to avoid route conflicts
router.get(
  '/admin',
  requirePermission('attendance.manage'),
  listAttendanceRecordsAdminHandler,
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

export const attendanceRouter = router
