import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  createSession,
  createTerm,
  generateChargesForSession,
  getFinanceSummary,
  getPupilFinance,
  getSession,
  getTerm,
  listFinancePupils,
  listSessions,
  listTerms,
  setSessionStatus,
  setTermStatus,
  updateSession,
  updateTerm,
} from '../services/finance.service'

export const financeSummaryHandler = asyncHandler(async (_req, res) => {
  const summary = await getFinanceSummary()
  res.json(ok(summary))
})

export const listFinancePupilsHandler = asyncHandler(async (req, res) => {
  const page = Number.parseInt(String(req.query.page ?? '1'), 10)
  const pageSize = Number.parseInt(String(req.query.pageSize ?? '20'), 10)
  const result = await listFinancePupils({
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    page,
    pageSize,
  })
  res.json(ok(result))
})

export const getPupilFinanceHandler = asyncHandler(async (req, res) => {
  const view = await getPupilFinance(req.params.id)
  res.json(ok(view))
})

export const listSessionsHandler = asyncHandler(async (_req, res) => {
  const sessions = await listSessions()
  res.json(ok(sessions))
})

export const getSessionHandler = asyncHandler(async (req, res) => {
  const session = await getSession(req.params.id)
  res.json(ok(session))
})

export const createSessionHandler = asyncHandler(async (req: AuthRequest, res) => {
  const session = await createSession(req.user!, req.body, req.ip)
  res.status(HttpStatus.Created).json(ok(session, 'Academic session created successfully.'))
})

export const updateSessionHandler = asyncHandler(async (req: AuthRequest, res) => {
  const session = await updateSession(req.user!, req.params.id, req.body, req.ip)
  res.json(ok(session, 'Academic session updated successfully.'))
})

export const activateSessionHandler = asyncHandler(async (req: AuthRequest, res) => {
  const session = await setSessionStatus(req.user!, req.params.id, 'ACTIVE', req.ip)
  res.json(ok(session, 'Academic session activated successfully.'))
})

export const deactivateSessionHandler = asyncHandler(async (req: AuthRequest, res) => {
  const session = await setSessionStatus(req.user!, req.params.id, 'INACTIVE', req.ip)
  res.json(ok(session, 'Academic session deactivated successfully.'))
})

export const listTermsHandler = asyncHandler(async (req, res) => {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined
  const terms = await listTerms(sessionId)
  res.json(ok(terms))
})

export const getTermHandler = asyncHandler(async (req, res) => {
  const term = await getTerm(req.params.id)
  res.json(ok(term))
})

export const createTermHandler = asyncHandler(async (req: AuthRequest, res) => {
  const term = await createTerm(req.user!, req.body, req.ip)
  res.status(HttpStatus.Created).json(ok(term, 'Academic term created successfully.'))
})

export const updateTermHandler = asyncHandler(async (req: AuthRequest, res) => {
  const term = await updateTerm(req.user!, req.params.id, req.body, req.ip)
  res.json(ok(term, 'Academic term updated successfully.'))
})

export const activateTermHandler = asyncHandler(async (req: AuthRequest, res) => {
  const term = await setTermStatus(req.user!, req.params.id, 'ACTIVE', req.ip)
  res.json(ok(term, 'Academic term activated successfully.'))
})

export const deactivateTermHandler = asyncHandler(async (req: AuthRequest, res) => {
  const term = await setTermStatus(req.user!, req.params.id, 'INACTIVE', req.ip)
  res.json(ok(term, 'Academic term deactivated successfully.'))
})

export const generateChargesHandler = asyncHandler(async (req: AuthRequest, res) => {
  const result = await generateChargesForSession(req.user!, req.body.sessionId, req.ip)
  res.json(ok(result, 'Charges generated successfully.'))
})