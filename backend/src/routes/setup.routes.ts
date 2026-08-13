import { Router } from 'express'
import { rateLimit } from 'express-rate-limit'
import { createOwnerHandler, setupStatusHandler } from '../controllers/setup.controller'
import { validate } from '../middleware/validate'
import { ownerSetupSchema } from '../schemas'

const router = Router()

const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { success: false, message: 'Too many setup attempts, please try again later.' },
})

// Initial school setup — available ONLY until the first Owner exists.
router.get('/status', setupStatusHandler)

router.post('/owner', setupLimiter, validate(ownerSetupSchema), createOwnerHandler)

export const setupRouter = router