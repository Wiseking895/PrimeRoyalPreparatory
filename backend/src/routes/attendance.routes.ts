import { Router } from 'express'
import {
  createAttendanceHandler,
  getAttendanceHandler,
  listAttendanceHandler,
  updateAttendanceHandler,
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