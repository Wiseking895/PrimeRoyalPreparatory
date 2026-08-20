import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import { asyncHandler } from '../utils/async-handler'
import { listAttendance, getAttendance, createAttendance, updateAttendance } from '../services/attendance.service'

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