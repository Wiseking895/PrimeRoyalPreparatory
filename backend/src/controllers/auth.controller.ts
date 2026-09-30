import { HttpStatus } from '../config/enums.js'
import { ok } from '../lib/api-response.js'
import type { AuthRequest } from '../types/auth.js'
import { asyncHandler } from '../utils/async-handler.js'
import { changePassword, completeFirstPasswordChange, getUserProfile, login } from '../services/auth.service.js'

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