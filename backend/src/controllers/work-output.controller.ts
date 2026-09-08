import { ok } from '../lib/api-response'
import { AppError } from '../utils/app-error'
import { HttpStatus } from '../config/enums'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  getWorkOutput,
  listWorkOutputForReview,
  getWorkOutputDetail,
  gradeWorkOutput,
  reviewWorkOutput,
  type GetWorkOutputOptions,
  type GradeWorkOutputInput,
} from '../services/work-output.service'

export const getWorkOutputHandler = asyncHandler(async (req, res) => {
  const options: GetWorkOutputOptions = {
    sessionId: typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined,
    termId: typeof req.query.termId === 'string' ? req.query.termId : undefined,
    teacherId: typeof req.query.teacherId === 'string' ? req.query.teacherId : undefined,
    subjectId: typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined,
    weekNumber: typeof req.query.weekNumber === 'string' ? Number(req.query.weekNumber) : undefined,
  }
  const summary = await getWorkOutput(options)
  res.json(ok(summary))
})

export const listWorkOutputForReviewHandler = asyncHandler(async (req, res) => {
  const records = await listWorkOutputForReview({
    sessionId: typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined,
    termId: typeof req.query.termId === 'string' ? req.query.termId : undefined,
    teacherId: typeof req.query.teacherId === 'string' ? req.query.teacherId : undefined,
    subjectId: typeof req.query.subjectId === 'string' ? req.query.subjectId : undefined,
    weekNumber: typeof req.query.weekNumber === 'string' ? Number(req.query.weekNumber) : undefined,
    reviewStatus: typeof req.query.reviewStatus === 'string' ? req.query.reviewStatus : undefined,
  })
  res.json(ok(records))
})

export const getWorkOutputDetailHandler = asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params
  if (!id) throw new AppError('Work output ID is required.', HttpStatus.BadRequest)
  const record = await getWorkOutputDetail(id)
  if (!record) throw new AppError('Work output record not found.', HttpStatus.NotFound)
  res.json(ok(record))
})

export const gradeWorkOutputHandler = asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params
  if (!id) throw new AppError('Work output ID is required.', HttpStatus.BadRequest)

  const { score, feedback } = req.body as { score?: number; feedback?: string }
  if (score === undefined || score === null) {
    throw new AppError('Score is required.', HttpStatus.BadRequest)
  }

  const input: GradeWorkOutputInput = { score, feedback }
  const graded = await gradeWorkOutput(req.user!.id, id, input)
  res.json(ok(graded))
})

export const reviewWorkOutputHandler = asyncHandler(async (req: AuthRequest, res) => {
  const { id } = req.params
  if (!id) throw new AppError('Work output ID is required.', HttpStatus.BadRequest)
  const reviewed = await reviewWorkOutput(req.user!.id, id)
  res.json(ok(reviewed))
})
