import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import {
  changePasswordHandler,
  firstPasswordChangeHandler,
  googleCallbackHandler,
  googleStartHandler,
  loginHandler,
  meHandler,
} from '../controllers/auth.controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { validate } from '../middleware/validate.js'
import { changePasswordSchema, firstPasswordChangeSchema, loginSchema } from '../schemas/index.js'

const router = Router()

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts, please try again later.' },
})

// First-time Owner sign-in with Google. Tighter than the global limiter
// because every hit redirects the browser out to an external provider.
const googleStartLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many sign-in attempts, please try again later.' },
})

// POST /change-password verifies the account's CURRENT password on every
// attempt, so it is a credential-guessing channel just like /login and needs
// its own budget (stricter than sign-in). first-password-change is NOT rate
// limited here: it verifies no credential — only the `mustChangePassword`
// flag — so there is nothing to brute-force beyond the existing session.
const passwordChangeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many password change attempts, please try again later.' },
})

router.post('/login', loginLimiter, validate(loginSchema), loginHandler)

// Google OAuth (first-time Owner sign-up only — never a general login path).
router.get('/google/start', googleStartLimiter, googleStartHandler)
router.get('/google/callback', googleCallbackHandler)

router.get('/me', requireAuth, meHandler)

router.post('/change-password', passwordChangeLimiter, requireAuth, validate(changePasswordSchema), changePasswordHandler)

router.post('/first-password-change', requireAuth, validate(firstPasswordChangeSchema), firstPasswordChangeHandler)

export const authRouter = router