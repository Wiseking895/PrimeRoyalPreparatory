import { Router } from 'express'
import {
  activateFeeHandler,
  assignFeeHandler,
  createFeeHandler,
  deactivateAssignmentHandler,
  deactivateFeeHandler,
  generateFeeChargesHandler,
  getFeeHandler,
  listFeeAssignmentsHandler,
  listFeesHandler,
  updateFeeHandler,
} from '../controllers/fees.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import { validate } from '../middleware/validate'
import { feeAssignSchema, feeCreateSchema, feeUpdateSchema } from '../schemas'

const router = Router()

router.use(requireAuth)

router.get('/', requirePermission('finance.view'), listFeesHandler)
router.post('/', requirePermission('fees.manage'), validate(feeCreateSchema), createFeeHandler)
router.post('/assignments/:id/deactivate', requirePermission('fees.manage'), deactivateAssignmentHandler)
router.get('/:id', requirePermission('finance.view'), getFeeHandler)
router.patch('/:id', requirePermission('fees.manage'), validate(feeUpdateSchema), updateFeeHandler)
router.post('/:id/activate', requirePermission('fees.manage'), activateFeeHandler)
router.post('/:id/deactivate', requirePermission('fees.manage'), deactivateFeeHandler)
router.post('/:id/assign', requirePermission('fees.manage'), validate(feeAssignSchema), assignFeeHandler)
router.get('/:id/assignments', requirePermission('finance.view'), listFeeAssignmentsHandler)
router.post('/:id/generate-charges', requirePermission('fees.manage'), generateFeeChargesHandler)

export const feesRouter = router