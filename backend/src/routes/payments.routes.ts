import { Router } from 'express'
import {
  createPaymentHandler,
  getPaymentHandler,
  listPaymentsHandler,
  markPaidHandler,
  markUnpaidHandler,
  voidPaymentHandler,
} from '../controllers/payments.controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requirePermission } from '../middleware/require-permission.js'
import { validate } from '../middleware/validate.js'
import { markPaidSchema, markUnpaidSchema, paymentCreateSchema, paymentVoidSchema } from '../schemas/index.js'

const router = Router()

router.use(requireAuth)

router.get('/', requirePermission('finance.view'), listPaymentsHandler)
router.post('/', requirePermission('payments.record'), validate(paymentCreateSchema), createPaymentHandler)
router.post('/mark-paid', requirePermission('payments.record'), validate(markPaidSchema), markPaidHandler)
router.post('/mark-unpaid', requirePermission('payments.record'), validate(markUnpaidSchema), markUnpaidHandler)
router.get('/:id', requirePermission('finance.view'), getPaymentHandler)
router.post('/:id/void', requirePermission('payments.record'), validate(paymentVoidSchema), voidPaymentHandler)

export const paymentsRouter = router