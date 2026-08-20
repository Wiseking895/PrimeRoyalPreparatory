import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  assertCanViewPupilReport,
  getTerminalReport,
  listReportPupils,
  listReportSessionsForPupil,
  listReportTermsForPupil,
} from '../services/report.service'

export const listReportPupilsHandler = asyncHandler(async (req: AuthRequest, res) => {
  const { q, classId } = req.query
  const result = await listReportPupils(req.user!, {
    q: typeof q === 'string' ? q : undefined,
    classId: typeof classId === 'string' ? classId : undefined,
  })
  res.json(ok(result))
})

export const getPupilReportSessionsHandler = asyncHandler(async (req: AuthRequest, res) => {
  await assertCanViewPupilReport(req.user!, req.params.pupilId, null)
  const sessions = await listReportSessionsForPupil(req.params.pupilId)
  res.json(ok(sessions))
})

export const getPupilReportTermsHandler = asyncHandler(async (req: AuthRequest, res) => {
  await assertCanViewPupilReport(req.user!, req.params.pupilId, null)
  const sessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined
  const terms = await listReportTermsForPupil(req.params.pupilId, sessionId)
  res.json(ok(terms))
})

export const getPupilReportHandler = asyncHandler(async (req: AuthRequest, res) => {
  await assertCanViewPupilReport(req.user!, req.params.pupilId, req.params.termId)
  const report = await getTerminalReport(req.params.pupilId, req.params.termId)
  res.json(ok(report))
})