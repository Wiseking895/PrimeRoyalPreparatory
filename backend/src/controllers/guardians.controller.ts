import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  createParentAccount,
  getGuardian,
  listGuardians,
  resendParentInvitation,
  setParentAccountStatus,
} from '../services/guardians.service'

export const listGuardiansHandler = asyncHandler(async (req: AuthRequest, res) => {
  const { q, account, status } = req.query
  const result = await listGuardians({
    q: typeof q === 'string' ? q : undefined,
    account: account === 'has_account' || account === 'no_account' ? account : undefined,
    status: status === 'ACTIVE' || status === 'INACTIVE' ? status : undefined,
  })
  res.json(ok(result))
})

export const getGuardianHandler = asyncHandler(async (req: AuthRequest, res) => {
  const guardian = await getGuardian(req.params.id)
  res.json(ok(guardian))
})

export const createParentAccountHandler = asyncHandler(async (req: AuthRequest, res) => {
  const result = await createParentAccount(req.user!, req.params.id, {
    accountEmail: req.body.accountEmail,
  }, req.ip)
  res.status(HttpStatus.Ok).json(ok(result, 'Parent portal account created. The invitation email has been sent.'))
})

export const resendParentInvitationHandler = asyncHandler(async (req: AuthRequest, res) => {
  const result = await resendParentInvitation(req.user!, req.params.id, req.ip)
  res.status(HttpStatus.Ok).json(ok(result, 'A new invitation email has been sent.'))
})

export const setParentAccountStatusHandler = asyncHandler(async (req: AuthRequest, res) => {
  const status = req.params.action === 'activate' ? 'ACTIVE' : 'INACTIVE'
  const guardian = await setParentAccountStatus(req.user!, req.params.id, status, req.ip)
  res.json(ok(guardian, status === 'ACTIVE' ? 'Parent account activated.' : 'Parent account deactivated.'))
})