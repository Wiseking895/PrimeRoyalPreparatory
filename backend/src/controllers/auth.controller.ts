import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import { changePassword, completeFirstPasswordChange, getUserProfile, login } from '../services/auth.service'

export const loginHandler = asyncHandler(async (req, res) => {
  const result = await login(req.body.identifier, req.body.password, req.ip)
  res.json(ok(result, 'Signed in successfully.'))
})

export const meHandler = asyncHandler(async (req: AuthRequest, res) => {
  const user = req.user
  const profile = await getUserProfile(user!.id)
  res.json(ok(profile))
})

export const changePasswordHandler = asyncHandler(async (req: AuthRequest, res) => {
  await changePassword(req.user!.id, req.body.currentPassword, req.body.newPassword, req.ip)
  res.status(HttpStatus.Ok).json(ok(null, 'Password updated successfully.'))
})

export const firstPasswordChangeHandler = asyncHandler(async (req: AuthRequest, res) => {
  await completeFirstPasswordChange(req.user!.id, req.body.newPassword, req.ip)
  res.status(HttpStatus.Ok).json(ok(null, 'Password set successfully. You can now continue.'))
})