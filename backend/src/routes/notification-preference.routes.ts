import { Router } from 'express'
import {
  getPreferencesHandler,
  updatePreferencesHandler,
} from '../controllers/notification-preference.controller.js'
import { requireAuth } from '../middleware/require-auth.js'

const router = Router()

router.use(requireAuth)
router.get('/', getPreferencesHandler)
router.patch('/', updatePreferencesHandler)

export const notificationPreferenceRouter = router
