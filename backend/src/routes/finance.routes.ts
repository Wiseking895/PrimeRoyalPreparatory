import { Router } from 'express'
import {
  activateSessionHandler,
  activateTermHandler,
  closeDailyReconciliationHandler,
  combinedReconciliationHandler,
  createSessionHandler,
  createTermHandler,
  dailyPupilFinanceHandler,
  deactivateSessionHandler,
  deactivateTermHandler,
  ensureChargesHandler,
  financeOverviewHandler,
  financeSummaryHandler,
  generateChargesHandler,
  getDailyReconciliationCloseStatusHandler,
  getPupilFinanceHandler,
  getSessionHandler,
  getTermHandler,
  listFinancePupilsHandler,
  listSessionsHandler,
  listTermsHandler,
  reconciliationHandler,
  updateReconciliationAttendanceHandler,
  updateSessionHandler,
  updateTermHandler,
} from '../controllers/finance.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import { validate } from '../middleware/validate'
import {
  chargeGenerateSchema,
  reconciliationAttendanceSchema,
  sessionCreateSchema,
  sessionUpdateSchema,
  termCreateSchema,
  termUpdateSchema,
} from '../schemas'

const router = Router()

router.use(requireAuth)

router.get('/summary', requirePermission('finance.view'), financeSummaryHandler)
router.get('/overview', requirePermission('finance.view'), financeOverviewHandler)
router.get('/reconciliation', requirePermission('finance.view'), reconciliationHandler)
router.get('/reconciliation/combined', requirePermission('finance.view'), combinedReconciliationHandler)
router.get('/reconciliation/close-status', requirePermission('finance.view'), getDailyReconciliationCloseStatusHandler)
router.post('/reconciliation/close', requirePermission('payments.record'), closeDailyReconciliationHandler)
router.patch(
  '/reconciliation/attendance',
  requirePermission('payments.record'),
  validate(reconciliationAttendanceSchema),
  updateReconciliationAttendanceHandler,
)
router.get('/pupils/daily', requirePermission('finance.view'), dailyPupilFinanceHandler)
router.get('/pupils', requirePermission('finance.view'), listFinancePupilsHandler)
router.get('/pupils/:id', requirePermission('finance.view'), getPupilFinanceHandler)
router.post('/generate-charges', requirePermission('fees.manage'), validate(chargeGenerateSchema), generateChargesHandler)
router.post('/ensure-charges', requirePermission('fees.manage'), ensureChargesHandler)

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