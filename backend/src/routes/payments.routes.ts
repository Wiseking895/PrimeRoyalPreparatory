import { Router } from 'express'
import {
  createPaymentHandler,
  getPaymentHandler,
  listPaymentsHandler,
  markPaidHandler,
  voidPaymentHandler,
} from '../controllers/payments.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import { validate } from '../middleware/validate'
import { markPaidSchema, paymentCreateSchema, paymentVoidSchema } from '../schemas'

const router = Router()

router.use(requireAuth)

router.get('/', requirePermission('finance.view'), listPaymentsHandler)
router.post('/', requirePermission('payments.record'), validate(paymentCreateSchema), createPaymentHandler)
router.post('/mark-paid', requirePermission('payments.record'), validate(markPaidSchema), markPaidHandler)
router.get('/:id', requirePermission('finance.view'), getPaymentHandler)
router.post('/:id/void', requirePermission('payments.record'), validate(paymentVoidSchema), voidPaymentHandler)

export const paymentsRouter = router