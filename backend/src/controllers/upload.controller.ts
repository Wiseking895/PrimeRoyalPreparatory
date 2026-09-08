import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  uploadProfilePicture,
  deleteProfilePicture,
  uploadPupilPicture,
  deletePupilPicture,
} from '../services/upload.service'

export const uploadProfilePictureHandler = asyncHandler(async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No image file provided.' })
    return
  }
  const result = await uploadProfilePicture(req.user!.id, req.file, req.ip)
  res.json(ok(result, 'Profile picture updated.'))
})

export const deleteProfilePictureHandler = asyncHandler(async (req: AuthRequest, res) => {
  await deleteProfilePicture(req.user!.id, req.ip)
  res.json(ok(null, 'Profile picture removed.'))
})

export const uploadPupilPictureHandler = asyncHandler(async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ success: false, message: 'No image file provided.' })
    return
  }
  const result = await uploadPupilPicture(req.user!.id, req.params.id, req.file, req.ip)
  res.json(ok(result, 'Pupil picture updated.'))
})

export const deletePupilPictureHandler = asyncHandler(async (req: AuthRequest, res) => {
  await deletePupilPicture(req.user!.id, req.params.id, req.ip)
  res.json(ok(null, 'Pupil picture removed.'))
})
