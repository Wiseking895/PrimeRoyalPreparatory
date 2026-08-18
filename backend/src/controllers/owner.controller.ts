import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  createHeadteacher,
  getHeadteacher,
  getOwnerSummary,
  listHeadteachers,
  resendHeadteacherInvitation,
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
  const result = await createHeadteacher(req.user!, req.body, req.ip)
  const message =
    result.invitation.status === 'failed'
      ? 'Headteacher account created, but the invitation email could not be sent.'
      : result.invitation.status === 'dev'
        ? 'Headteacher account created. Invitation logged to the server console (development transport).'
        : 'Headteacher account created. The invitation email has been sent.'
  res.status(HttpStatus.Created).json(ok(result, message))
})

export const resendHeadteacherInvitationHandler = asyncHandler(async (req: AuthRequest, res) => {
  const result = await resendHeadteacherInvitation(req.user!, req.params.id, req.ip)
  const message =
    result.invitation.status === 'failed'
      ? 'A new temporary credential was generated, but the invitation email could not be sent.'
      : result.invitation.status === 'dev'
        ? 'A fresh temporary credential was generated. Invitation logged to the server console (development transport).'
        : 'Invitation email sent again with a fresh temporary credential.'
  res.json(ok(result, message))
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