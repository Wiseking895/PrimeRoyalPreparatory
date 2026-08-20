import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  createPayment,
  getPayment,
  listPayments,
  voidPayment,
} from '../services/finance.service'

const parseStatus = (value: unknown) => (value === 'ACTIVE' || value === 'VOIDED' ? value : undefined)

export const listPaymentsHandler = asyncHandler(async (req, res) => {
  const page = Number.parseInt(String(req.query.page ?? '1'), 10)
  const pageSize = Number.parseInt(String(req.query.pageSize ?? '20'), 10)
  const method =
    req.query.paymentMethod === 'CASH' ||
    req.query.paymentMethod === 'BANK_TRANSFER' ||
    req.query.paymentMethod === 'MOBILE_MONEY' ||
    req.query.paymentMethod === 'CHEQUE'
      ? req.query.paymentMethod
      : undefined
  const result = await listPayments({
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    pupilId: typeof req.query.pupilId === 'string' ? req.query.pupilId : undefined,
    status: parseStatus(req.query.status),
    paymentMethod: method,
    from: typeof req.query.from === 'string' ? req.query.from : undefined,
    to: typeof req.query.to === 'string' ? req.query.to : undefined,
    page,
    pageSize,
  })
  res.json(ok(result))
})

export const createPaymentHandler = asyncHandler(async (req: AuthRequest, res) => {
  const payment = await createPayment(req.user!, req.body, req.ip)
  res.status(HttpStatus.Created).json(ok(payment, 'Payment recorded successfully.'))
})

export const getPaymentHandler = asyncHandler(async (req, res) => {
  const payment = await getPayment(req.params.id)
  res.json(ok(payment))
})

export const voidPaymentHandler = asyncHandler(async (req: AuthRequest, res) => {
  const payment = await voidPayment(req.user!, req.params.id, req.body, req.ip)
  res.json(ok(payment, 'Payment voided successfully.'))
})