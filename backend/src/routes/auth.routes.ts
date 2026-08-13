import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { changePasswordHandler, loginHandler, meHandler } from '../controllers/auth.controller'
import { requireAuth } from '../middleware/require-auth'
import { validate } from '../middleware/validate'
import { changePasswordSchema, loginSchema } from '../schemas'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts, please try again later.' },
})

router.post('/login', loginLimiter, validate(loginSchema), loginHandler)

router.get('/me', requireAuth, meHandler)

router.post('/change-password', requireAuth, validate(changePasswordSchema), changePasswordHandler)

export const authRouter = router