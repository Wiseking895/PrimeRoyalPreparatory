import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import { createSubject, getSubject, listSubjects, setSubjectStatus, updateSubject } from '../services/subject.service'

export const listSubjectsHandler = asyncHandler(async (req, res) => {
  const status = req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE' ? req.query.status : undefined
  const subjects = await listSubjects({
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    status,
  })
  res.json(ok(subjects))
})

export const getSubjectHandler = asyncHandler(async (req, res) => {
  const subject = await getSubject(req.params.id)
  res.json(ok(subject))
})

export const createSubjectHandler = asyncHandler(async (req: AuthRequest, res) => {
  const subject = await createSubject(req.user!, req.body, req.ip)
  res.status(HttpStatus.Created).json(ok(subject, 'Subject created successfully.'))
})

export const updateSubjectHandler = asyncHandler(async (req: AuthRequest, res) => {
  const subject = await updateSubject(req.user!, req.params.id, req.body, req.ip)
  res.json(ok(subject, 'Subject updated successfully.'))
})

export const activateSubjectHandler = asyncHandler(async (req: AuthRequest, res) => {
  const subject = await setSubjectStatus(req.user!, req.params.id, 'ACTIVE', req.ip)
  res.json(ok(subject, 'Subject activated successfully.'))
})

export const deactivateSubjectHandler = asyncHandler(async (req: AuthRequest, res) => {
  const subject = await setSubjectStatus(req.user!, req.params.id, 'INACTIVE', req.ip)
  res.json(ok(subject, 'Subject deactivated successfully.'))
})