import { ok } from '../lib/api-response'
import type { ParentRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  getMyPupil,
  getMyPupilFinance,
  getMyReport,
  getMyReportSessions,
  getMyReportTerms,
  listMyPupils,
} from '../services/parent-portal.service'

export const listMyPupilsHandler = asyncHandler(async (req: ParentRequest, res) => {
  const children = await listMyPupils(req.parent!.id)
  res.json(ok(children))
})

export const getMyPupilHandler = asyncHandler(async (req: ParentRequest, res) => {
  const child = await getMyPupil(req.parent!.id, req.params.pupilId)
  res.json(ok(child))
})

export const getMyPupilFinanceHandler = asyncHandler(async (req: ParentRequest, res) => {
  const finance = await getMyPupilFinance(req.parent!.id, req.params.pupilId)
  res.json(ok(finance))
})

export const getMyReportSessionsHandler = asyncHandler(async (req: ParentRequest, res) => {
  const sessions = await getMyReportSessions(req.parent!.id, req.params.pupilId)
  res.json(ok(sessions))
})

export const getMyReportTermsHandler = asyncHandler(async (req: ParentRequest, res) => {
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined
  const terms = await getMyReportTerms(req.parent!.id, req.params.pupilId, sessionId)
  res.json(ok(terms))
})

export const getMyReportHandler = asyncHandler(async (req: ParentRequest, res) => {
  const report = await getMyReport(req.parent!.id, req.params.pupilId, req.params.termId)
  res.json(ok(report))
})