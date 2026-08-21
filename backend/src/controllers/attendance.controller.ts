import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import { asyncHandler } from '../utils/async-handler'
import {
  listAttendance,
  getAttendance,
  createAttendance,
  updateAttendance,
} from '../services/attendance.service'
import { checkInStaff, getStaffTodayAttendance, listAttendanceRecordsAdmin } from '../services/gps-attendance.service'

export const listAttendanceHandler = asyncHandler(async (req, res) => {
  const status = req.query.status as string | undefined
  const attendance = await listAttendance({
    pupilId: typeof req.query.pupilId === 'string' ? req.query.pupilId : undefined,
    status,
    staffId: typeof req.query.staffId === 'string' ? req.query.staffId : undefined,
    sessionId: typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined,
    classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
    dateFrom: typeof req.query.dateFrom === 'string' ? req.query.dateFrom : undefined,
    dateTo: typeof req.query.dateTo === 'string' ? req.query.dateTo : undefined,
  })
  res.json(ok(attendance))
})

export const getAttendanceHandler = asyncHandler(async (req, res) => {
  const attendance = await getAttendance(req.params.id)
  res.json(ok(attendance))
})

export const createAttendanceHandler = asyncHandler(async (req, res) => {
  const result = await createAttendance(req.body)
  res.status(HttpStatus.Created).json(ok(result, 'Attendance recorded successfully.'))
})

export const updateAttendanceHandler = asyncHandler(async (req, res) => {
  const result = await updateAttendance(req.params.id, req.body)
  res.json(ok(result, 'Attendance updated successfully.'))
})

export const checkInStaffHandler = asyncHandler(async (req: any, res) => {
  const { latitude, longitude, accuracy, capturedAt } = req.body
  const staffUserId = req.user?.id

  if (!staffUserId) {
    throw new Error('Authentication required.')
  }

  // Security: The :id parameter must match the authenticated user.
  // A staff member must only check in themselves.
  const requestedId = req.params.id
  if (requestedId && requestedId !== staffUserId) {
    res.status(HttpStatus.Forbidden).json(ok(null, 'You can only check in yourself.'))
    return
  }

  if (latitude === undefined || longitude === undefined || accuracy === undefined || capturedAt === undefined) {
    throw new Error('Missing required GPS parameters.')
  }

  const result = await checkInStaff(latitude, longitude, accuracy, capturedAt, staffUserId)
  res.status(HttpStatus.Created).json(ok(result))
})

export const getStaffTodayAttendanceHandler = asyncHandler(async (req: any, res) => {
  const staffUserId = req.user?.id

  if (!staffUserId) {
    throw new Error('Authentication required.')
  }

  const result = await getStaffTodayAttendance(staffUserId)
  res.json(ok(result))
})

export const listAttendanceRecordsAdminHandler = asyncHandler(async (req: any, res) => {
  const { staffId, dateFrom, dateTo } = req.query

  const result = await listAttendanceRecordsAdmin({
    staffId: typeof staffId === 'string' ? staffId : undefined,
    dateFrom: dateFrom ? String(dateFrom) : undefined,
    dateTo: dateTo ? String(dateTo) : undefined,
  })
  res.json(ok(result))
})
