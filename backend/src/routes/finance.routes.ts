import { Router } from 'express'
import {
  activateSessionHandler,
  activateTermHandler,
  createSessionHandler,
  createTermHandler,
  deactivateSessionHandler,
  deactivateTermHandler,
  financeSummaryHandler,
  generateChargesHandler,
  getPupilFinanceHandler,
  getSessionHandler,
  getTermHandler,
  listFinancePupilsHandler,
  listSessionsHandler,
  listTermsHandler,
  updateSessionHandler,
  updateTermHandler,
} from '../controllers/finance.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import { validate } from '../middleware/validate'
import {
  chargeGenerateSchema,
  sessionCreateSchema,
  sessionUpdateSchema,
  termCreateSchema,
  termUpdateSchema,
} from '../schemas'

const router = Router()

router.use(requireAuth)

router.get('/summary', requirePermission('finance.view'), financeSummaryHandler)
router.get('/pupils', requirePermission('finance.view'), listFinancePupilsHandler)
router.get('/pupils/:id', requirePermission('finance.view'), getPupilFinanceHandler)
router.post('/generate-charges', requirePermission('fees.manage'), validate(chargeGenerateSchema), generateChargesHandler)

router.get('/sessions', requirePermission('academic.view'), listSessionsHandler)
router.post('/sessions', requirePermission('academic.manage'), validate(sessionCreateSchema), createSessionHandler)
router.get('/sessions/:id', requirePermission('academic.view'), getSessionHandler)
router.patch('/sessions/:id', requirePermission('academic.manage'), validate(sessionUpdateSchema), updateSessionHandler)
router.post('/sessions/:id/activate', requirePermission('academic.manage'), activateSessionHandler)
router.post('/sessions/:id/deactivate', requirePermission('academic.manage'), deactivateSessionHandler)

router.get('/terms', requirePermission('academic.view'), listTermsHandler)
router.post('/terms', requirePermission('academic.manage'), validate(termCreateSchema), createTermHandler)
router.get('/terms/:id', requirePermission('academic.view'), getTermHandler)
router.patch('/terms/:id', requirePermission('academic.manage'), validate(termUpdateSchema), updateTermHandler)
router.post('/terms/:id/activate', requirePermission('academic.manage'), activateTermHandler)
router.post('/terms/:id/deactivate', requirePermission('academic.manage'), deactivateTermHandler)

export const financeRouter = router