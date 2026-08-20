import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { AppError } from '../utils/app-error'
import { asyncHandler } from '../utils/async-handler'
import {
  getSbaEntryData,
  getSbaRecord,
  listSba,
  updateSbaRecord,
  upsertSbaBulk,
} from '../services/sba.service'

export const listSbaHandler = asyncHandler(async (req: AuthRequest, res) => {
  const { sessionId, termId, classId, subjectId, pupilId, teacherId } = req.query
  const records = await listSba(req.user!, {
    sessionId: typeof sessionId === 'string' ? sessionId : undefined,
    termId: typeof termId === 'string' ? termId : undefined,
    classId: typeof classId === 'string' ? classId : undefined,
    subjectId: typeof subjectId === 'string' ? subjectId : undefined,
    pupilId: typeof pupilId === 'string' ? pupilId : undefined,
    teacherId: typeof teacherId === 'string' ? teacherId : undefined,
  })
  res.json(ok(records))
})

export const getSbaRecordHandler = asyncHandler(async (req: AuthRequest, res) => {
  const record = await getSbaRecord(req.user!, req.params.id)
  res.json(ok(record))
})

export const sbaEntryDataHandler = asyncHandler(async (req: AuthRequest, res) => {
  const classId = typeof req.query.classId === 'string' ? req.query.classId : ''
  const subjectId = typeof req.query.subjectId === 'string' ? req.query.subjectId : ''
  const termId = typeof req.query.termId === 'string' ? req.query.termId : ''
  if (!classId || !subjectId || !termId) {
    throw new AppError('Class, subject and term are required.', HttpStatus.BadRequest)
  }
  const data = await getSbaEntryData(req.user!, { classId, subjectId, termId })
  res.json(ok(data))
})

export const sbaBulkHandler = asyncHandler(async (req: AuthRequest, res) => {
  const result = await upsertSbaBulk(req.user!, req.body, req.ip)
  res.json(ok(result, 'SBA scores saved successfully.'))
})

export const updateSbaRecordHandler = asyncHandler(async (req: AuthRequest, res) => {
  const record = await updateSbaRecord(req.user!, req.params.id, req.body, req.ip)
  res.json(ok(record, 'SBA record updated successfully.'))
})