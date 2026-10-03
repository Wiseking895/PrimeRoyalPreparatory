import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  parentChangePasswordHandler,
  parentFirstPasswordChangeHandler,
  parentLoginHandler,
  parentMeHandler,
} from '../controllers/parent-auth.controller.js'
import {
  getMyPupilFinanceHandler,
  getMyPupilHandler,
  getMyReportHandler,
  getMyReportSessionsHandler,
  getMyReportTermsHandler,
  listMyPupilsHandler,
} from '../controllers/parent-portal.controller.js'
import { requireParentAuth } from '../middleware/require-parent-auth.js'
import { parentGetDocumentUrlHandler } from '../controllers/document.controller.js'
import { validate } from '../middleware/validate.js'
import {
  parentChangePasswordSchema,
  parentFirstPasswordChangeSchema,
  parentLoginSchema,
} from '../schemas/index.js'

const router = Router()

const parentLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts, please try again later.' },
})

// Mirrors the staff-side limiter: this endpoint verifies the guardian's
// current password on every attempt, so it gets its own guessing budget.
const parentPasswordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many password change attempts, please try again later.' },
})

router.post('/login', parentLoginLimiter, validate(parentLoginSchema), parentLoginHandler)

router.get('/me', requireParentAuth, parentMeHandler)

router.post(
  '/change-password',
  parentPasswordChangeLimiter,
  requireParentAuth,
  validate(parentChangePasswordSchema),
  parentChangePasswordHandler,
)

router.post('/first-password-change', requireParentAuth, validate(parentFirstPasswordChangeSchema), parentFirstPasswordChangeHandler)

router.get('/children', requireParentAuth, listMyPupilsHandler)

router.get('/children/:pupilId', requireParentAuth, getMyPupilHandler)

router.get('/children/:pupilId/finance', requireParentAuth, getMyPupilFinanceHandler)

router.get('/children/:pupilId/reports', requireParentAuth, getMyReportTermsHandler)

router.get('/children/:pupilId/reports/sessions', requireParentAuth, getMyReportSessionsHandler)

router.get('/children/:pupilId/reports/terms/:termId', requireParentAuth, getMyReportHandler)

// Stored documents (private R2 objects) belonging to the guardian's own children.
router.get('/documents/:documentId/url', requireParentAuth, parentGetDocumentUrlHandler)

export const parentRouter = router