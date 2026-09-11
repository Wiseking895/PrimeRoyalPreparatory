import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import { getOwnerFinanceOverview } from '../services/owner.service'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  closeDailyReconciliation,
  createSession,
  createTerm,
  ensureChargesForActiveSession,
  generateChargesForSession,
  getCombinedReconciliation,
  getDailyPupilFinance,
  getDailyReconciliationCloseStatus,
  getFinanceSummary,
  getPupilFinance,
  getReconciliation,
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

export const financeOverviewHandler = asyncHandler(async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined
  const overview = await getOwnerFinanceOverview(date)
  res.json(ok(overview))
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

export const ensureChargesHandler = asyncHandler(async (_req: AuthRequest, res) => {
  const result = await ensureChargesForActiveSession()
  res.json(ok(result, 'Charge reconciliation complete.'))
})

export const reconciliationHandler = asyncHandler(async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined
  const feeType = typeof req.query.feeType === 'string' ? req.query.feeType : undefined

  if (!date) {
    res.status(HttpStatus.BadRequest).json({ success: false, message: 'date query parameter is required (YYYY-MM-DD).' })
    return
  }
  if (!feeType || (feeType !== 'DAILY' && feeType !== 'PA')) {
    res.status(HttpStatus.BadRequest).json({ success: false, message: 'feeType query parameter is required (DAILY or PA).' })
    return
  }

  const result = await getReconciliation({ date, feeType })
  res.json(ok(result))
})

export const dailyPupilFinanceHandler = asyncHandler(async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined
  if (!date) {
    res.status(HttpStatus.BadRequest).json({ success: false, message: 'date query parameter is required (YYYY-MM-DD).' })
    return
  }

  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined
  const q = typeof req.query.q === 'string' ? req.query.q : undefined

  const result = await getDailyPupilFinance({ date, classId, q })
  res.json(ok(result))
})

export const combinedReconciliationHandler = asyncHandler(async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined
  if (!date) {
    res.status(HttpStatus.BadRequest).json({ success: false, message: 'date query parameter is required (YYYY-MM-DD).' })
    return
  }

  const classId = typeof req.query.classId === 'string' ? req.query.classId : undefined
  const q = typeof req.query.q === 'string' ? req.query.q : undefined

  const result = await getCombinedReconciliation({ date, classId, q })
  res.json(ok(result))
})

export const closeDailyReconciliationHandler = asyncHandler(async (req: AuthRequest, res) => {
  const date = typeof req.body?.date === 'string' ? req.body.date : undefined
  if (!date) {
    res.status(HttpStatus.BadRequest).json({ success: false, message: 'date field is required (YYYY-MM-DD).' })
    return
  }

  const result = await closeDailyReconciliation(req.user!, date, req.ip)
  res.status(HttpStatus.Created).json(ok(result, 'Daily reconciliation closed and signed successfully.'))
})

export const getDailyReconciliationCloseStatusHandler = asyncHandler(async (req, res) => {
  const date = typeof req.query.date === 'string' ? req.query.date : undefined
  if (!date) {
    res.status(HttpStatus.BadRequest).json({ success: false, message: 'date query parameter is required (YYYY-MM-DD).' })
    return
  }

  const result = await getDailyReconciliationCloseStatus(date)
  res.json(ok(result))
})