import { Router } from 'express'
import {
  createParentAccountHandler,
  getGuardianHandler,
  listGuardiansHandler,
  resendParentInvitationHandler,
  setParentAccountStatusHandler,
} from '../controllers/guardians.controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requirePermission } from '../middleware/require-permission.js'
import { validate } from '../middleware/validate.js'
import { parentAccountCreateSchema } from '../schemas/index.js'

const router = Router()

router.get('/', requireAuth, requirePermission('guardians.view'), listGuardiansHandler)

router.get('/:id', requireAuth, requirePermission('guardians.view'), getGuardianHandler)

router.post(
  '/:id/parent-account',
  requireAuth,
  requirePermission('guardians.manage'),
  validate(parentAccountCreateSchema),
  createParentAccountHandler,
)

router.post(
  '/:id/parent-account/resend',
  requireAuth,
  requirePermission('guardians.manage'),
  resendParentInvitationHandler,
)

router.post(
  '/:id/parent-account/:action',
  requireAuth,
  requirePermission('guardians.manage'),
  setParentAccountStatusHandler,
)

export const guardiansRouter = router