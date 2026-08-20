import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { ParentRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  changeParentPassword,
  completeParentFirstPasswordChange,
  getParentProfile,
  parentLogin,
} from '../services/parent-auth.service'

export const parentLoginHandler = asyncHandler(async (req, res) => {
  const result = await parentLogin(req.body.identifier, req.body.password, req.ip)
  res.json(ok(result, 'Signed in successfully.'))
})

export const parentMeHandler = asyncHandler(async (req: ParentRequest, res) => {
  const profile = await getParentProfile(req.parent!.id)
  res.json(ok(profile))
})

export const parentChangePasswordHandler = asyncHandler(async (req: ParentRequest, res) => {
  await changeParentPassword(req.parent!.id, req.body.currentPassword, req.body.newPassword, req.ip)
  res.status(HttpStatus.Ok).json(ok(null, 'Password updated successfully.'))
})

export const parentFirstPasswordChangeHandler = asyncHandler(async (req: ParentRequest, res) => {
  await completeParentFirstPasswordChange(req.parent!.id, req.body.newPassword, req.ip)
  res.status(HttpStatus.Ok).json(ok(null, 'Password set successfully. You can now continue.'))
})