import { HttpStatus } from '@prps/shared'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  createHeadteacher,
  getHeadteacher,
  getOwnerSummary,
  listHeadteachers,
  setHeadteacherPermissions,
  setHeadteacherStatus,
  updateHeadteacher,
} from '../services/owner.service'

export const ownerSummaryHandler = asyncHandler(async (_req, res) => {
  const summary = await getOwnerSummary()
  res.json(ok(summary))
})

export const listHeadteachersHandler = asyncHandler(async (_req, res) => {
  const headteachers = await listHeadteachers()
  res.json(ok(headteachers))
})

export const getHeadteacherHandler = asyncHandler(async (req, res) => {
  const headteacher = await getHeadteacher(req.params.id)
  res.json(ok(headteacher))
})

export const createHeadteacherHandler = asyncHandler(async (req: AuthRequest, res) => {
  const headteacher = await createHeadteacher(req.user!, req.body, req.ip)
  res.status(HttpStatus.Created).json(ok(headteacher, 'Headteacher account created successfully.'))
})

export const updateHeadteacherHandler = asyncHandler(async (req: AuthRequest, res) => {
  const headteacher = await updateHeadteacher(req.user!, req.params.id, req.body, req.ip)
  res.json(ok(headteacher, 'Headteacher account updated successfully.'))
})

export const activateHeadteacherHandler = asyncHandler(async (req: AuthRequest, res) => {
  const headteacher = await setHeadteacherStatus(req.user!, req.params.id, 'ACTIVE', req.ip)
  res.json(ok(headteacher, 'Headteacher activated successfully.'))
})

export const deactivateHeadteacherHandler = asyncHandler(async (req: AuthRequest, res) => {
  const headteacher = await setHeadteacherStatus(req.user!, req.params.id, 'INACTIVE', req.ip)
  res.json(ok(headteacher, 'Headteacher deactivated successfully.'))
})

export const headteacherPermissionsHandler = asyncHandler(async (req: AuthRequest, res) => {
  const headteacher = await setHeadteacherPermissions(
    req.user!,
    req.params.id,
    req.body.permissionKeys,
    req.ip,
  )
  res.json(ok(headteacher, 'Headteacher permissions updated successfully.'))
})