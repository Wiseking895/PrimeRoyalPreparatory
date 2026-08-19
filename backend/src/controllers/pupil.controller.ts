import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  createPupil,
  getPupil,
  getPupilStats,
  listPupils,
  setPupilStatus,
  updatePupil,
} from '../services/pupil.service'

export const listPupilsHandler = asyncHandler(async (req, res) => {
  const page = Number.parseInt(String(req.query.page ?? '1'), 10)
  const pageSize = Number.parseInt(String(req.query.pageSize ?? '20'), 10)
  const status = req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE' ? req.query.status : undefined
  const sortBy =
    req.query.sortBy === 'name' ||
    req.query.sortBy === 'dateAdmitted' ||
    req.query.sortBy === 'createdAt' ||
    req.query.sortBy === 'updatedAt'
      ? req.query.sortBy
      : undefined
  const order = req.query.order === 'asc' || req.query.order === 'desc' ? req.query.order : undefined

  const result = await listPupils({
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    status,
    classId: typeof req.query.classId === 'string' ? req.query.classId : undefined,
    sortBy,
    order,
    page,
    pageSize,
  })
  res.json(ok(result))
})

export const getPupilHandler = asyncHandler(async (req, res) => {
  const pupil = await getPupil(req.params.id)
  res.json(ok(pupil))
})

export const createPupilHandler = asyncHandler(async (req: AuthRequest, res) => {
  const pupil = await createPupil(req.user!, req.body, req.ip)
  res.status(HttpStatus.Created).json(ok(pupil, 'Pupil registered successfully.'))
})

export const updatePupilHandler = asyncHandler(async (req: AuthRequest, res) => {
  const pupil = await updatePupil(req.user!, req.params.id, req.body, req.ip)
  res.json(ok(pupil, 'Pupil record updated successfully.'))
})

export const activatePupilHandler = asyncHandler(async (req: AuthRequest, res) => {
  const pupil = await setPupilStatus(req.user!, req.params.id, 'ACTIVE', req.ip)
  res.json(ok(pupil, 'Pupil activated successfully.'))
})

export const deactivatePupilHandler = asyncHandler(async (req: AuthRequest, res) => {
  const pupil = await setPupilStatus(req.user!, req.params.id, 'INACTIVE', req.ip)
  res.json(ok(pupil, 'Pupil deactivated successfully.'))
})

export const pupilStatsHandler = asyncHandler(async (_req, res) => {
  const stats = await getPupilStats()
  res.json(ok(stats))
})
