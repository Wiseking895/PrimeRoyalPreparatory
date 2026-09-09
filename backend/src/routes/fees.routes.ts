import { Router } from 'express'
import {
  activateFeeHandler,
  assignFeeHandler,
  createFeeHandler,
  createFeesBatchHandler,
  deactivateAssignmentHandler,
  deactivateFeeHandler,
  exemptPupilHandler,
  generateFeeChargesHandler,
  getFeeHandler,
  listFeeAssignmentsHandler,
  listFeesHandler,
  removeExemptionHandler,
  updateFeeHandler,
} from '../controllers/fees.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import { validate } from '../middleware/validate'
import { feeAssignSchema, feeBatchCreateSchema, feeCreateSchema, feeUpdateSchema } from '../schemas'

const router = Router()

router.use(requireAuth)

router.get('/', requirePermission('finance.view'), listFeesHandler)
router.post('/', requirePermission('fees.manage'), validate(feeCreateSchema), createFeeHandler)
router.post('/batch', requirePermission('fees.manage'), validate(feeBatchCreateSchema), createFeesBatchHandler)
router.post('/assignments/:id/deactivate', requirePermission('fees.manage'), deactivateAssignmentHandler)
router.post('/assignments/:id/exempt', requirePermission('fees.manage'), exemptPupilHandler)
router.post('/assignments/:id/remove-exemption', requirePermission('fees.manage'), removeExemptionHandler)
router.get('/:id', requirePermission('finance.view'), getFeeHandler)
router.patch('/:id', requirePermission('fees.manage'), validate(feeUpdateSchema), updateFeeHandler)
router.post('/:id/activate', requirePermission('fees.manage'), activateFeeHandler)
router.post('/:id/deactivate', requirePermission('fees.manage'), deactivateFeeHandler)
router.post('/:id/assign', requirePermission('fees.manage'), validate(feeAssignSchema), assignFeeHandler)
router.get('/:id/assignments', requirePermission('finance.view'), listFeeAssignmentsHandler)
router.post('/:id/generate-charges', requirePermission('fees.manage'), generateFeeChargesHandler)

export const feesRouter = router