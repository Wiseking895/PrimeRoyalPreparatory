import { Router } from 'express'
import {
  listDeveloperAccountsHandler,
  startImpersonationHandler,
  stopImpersonationHandler,
  switchImpersonationHandler,
} from '../controllers/developer.controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { validate } from '../middleware/validate.js'
import { z } from 'zod'

const router = Router()

const impersonateSchema = z.object({
  targetUserId: z.string().trim().min(1, 'Target user ID is required.'),
})

router.get('/accounts', requireAuth, listDeveloperAccountsHandler)

router.post('/impersonate', requireAuth, validate(impersonateSchema), startImpersonationHandler)

router.post('/stop-impersonation', requireAuth, stopImpersonationHandler)

router.post('/switch-account', requireAuth, validate(impersonateSchema), switchImpersonationHandler)

export const developerRouter = router
