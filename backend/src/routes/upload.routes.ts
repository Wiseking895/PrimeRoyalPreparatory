import { Router } from 'express'
import multer from 'multer'
import { MAX_UPLOAD_FILE_BYTES } from '../config/upload.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requirePermission } from '../middleware/require-permission.js'
import {
  uploadProfilePictureHandler,
  deleteProfilePictureHandler,
  uploadPupilPictureHandler,
  deletePupilPictureHandler,
} from '../controllers/upload.controller.js'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_FILE_BYTES },
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
