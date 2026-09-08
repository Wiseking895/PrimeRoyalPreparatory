import { Router } from 'express'
import multer from 'multer'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import {
  uploadProfilePictureHandler,
  deleteProfilePictureHandler,
  uploadPupilPictureHandler,
  deletePupilPictureHandler,
} from '../controllers/upload.controller'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
})

router.post(
  '/profile-picture',
  requireAuth,
  upload.single('image'),
  uploadProfilePictureHandler,
)

router.delete('/profile-picture', requireAuth, deleteProfilePictureHandler)

router.post(
  '/pupils/:id/picture',
  requireAuth,
  requirePermission('pupils.update'),
  upload.single('image'),
  uploadPupilPictureHandler,
)

router.delete(
  '/pupils/:id/picture',
  requireAuth,
  requirePermission('pupils.update'),
  deletePupilPictureHandler,
)

export const uploadRouter = router
