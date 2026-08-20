import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  assignPupilsToFee,
  createFee,
  deactivateAssignment,
  generateChargesForFee,
  getFee,
  listFeeAssignments,
  listFees,
  setFeeStatus,
  updateFee,
} from '../services/finance.service'

export const listFeesHandler = asyncHandler(async (req, res) => {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined
  const status = req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE' ? req.query.status : undefined
  const fees = await listFees({ sessionId, status })
  res.json(ok(fees))
})

export const getFeeHandler = asyncHandler(async (req, res) => {
  const fee = await getFee(req.params.id)
  res.json(ok(fee))
})

export const createFeeHandler = asyncHandler(async (req: AuthRequest, res) => {
  const fee = await createFee(req.user!, req.body, req.ip)
  res.status(HttpStatus.Created).json(ok(fee, 'Fee structure created successfully.'))
})

export const updateFeeHandler = asyncHandler(async (req: AuthRequest, res) => {
  const fee = await updateFee(req.user!, req.params.id, req.body, req.ip)
  res.json(ok(fee, 'Fee structure updated successfully.'))
})

export const activateFeeHandler = asyncHandler(async (req: AuthRequest, res) => {
  const fee = await setFeeStatus(req.user!, req.params.id, 'ACTIVE', req.ip)
  res.json(ok(fee, 'Fee structure activated successfully.'))
})

export const deactivateFeeHandler = asyncHandler(async (req: AuthRequest, res) => {
  const fee = await setFeeStatus(req.user!, req.params.id, 'INACTIVE', req.ip)
  res.json(ok(fee, 'Fee structure deactivated successfully.'))
})

export const assignFeeHandler = asyncHandler(async (req: AuthRequest, res) => {
  const result = await assignPupilsToFee(req.user!, req.params.id, req.body, req.ip)
  res.json(ok(result, 'Pupils assigned to the fee successfully.'))
})

export const listFeeAssignmentsHandler = asyncHandler(async (req, res) => {
  const assignments = await listFeeAssignments(req.params.id)
  res.json(ok(assignments))
})

export const deactivateAssignmentHandler = asyncHandler(async (req: AuthRequest, res) => {
  const assignment = await deactivateAssignment(req.user!, req.params.id, req.ip)
  res.json(ok(assignment, 'Fee assignment deactivated successfully.'))
})

export const generateFeeChargesHandler = asyncHandler(async (req: AuthRequest, res) => {
  const result = await generateChargesForFee(req.user!, req.params.id, req.ip)
  res.json(ok(result, 'Charges generated successfully.'))
})