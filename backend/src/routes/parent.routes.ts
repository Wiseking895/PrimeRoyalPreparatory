import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  parentChangePasswordHandler,
  parentFirstPasswordChangeHandler,
  parentLoginHandler,
  parentMeHandler,
} from '../controllers/parent-auth.controller'
import {
  getMyPupilFinanceHandler,
  getMyPupilHandler,
  getMyReportHandler,
  getMyReportSessionsHandler,
  getMyReportTermsHandler,
  listMyPupilsHandler,
} from '../controllers/parent-portal.controller'
import { requireParentAuth } from '../middleware/require-parent-auth'
import { validate } from '../middleware/validate'
import {
  parentChangePasswordSchema,
  parentFirstPasswordChangeSchema,
  parentLoginSchema,
} from '../schemas'

const router = Router()

const parentLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts, please try again later.' },
})

router.post('/login', parentLoginLimiter, validate(parentLoginSchema), parentLoginHandler)

router.get('/me', requireParentAuth, parentMeHandler)

router.post('/change-password', requireParentAuth, validate(parentChangePasswordSchema), parentChangePasswordHandler)

router.post('/first-password-change', requireParentAuth, validate(parentFirstPasswordChangeSchema), parentFirstPasswordChangeHandler)

router.get('/children', requireParentAuth, listMyPupilsHandler)

router.get('/children/:pupilId', requireParentAuth, getMyPupilHandler)

router.get('/children/:pupilId/finance', requireParentAuth, getMyPupilFinanceHandler)

router.get('/children/:pupilId/reports', requireParentAuth, getMyReportTermsHandler)

router.get('/children/:pupilId/reports/sessions', requireParentAuth, getMyReportSessionsHandler)

router.get('/children/:pupilId/reports/terms/:termId', requireParentAuth, getMyReportHandler)

export const parentRouter = router