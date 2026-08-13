import { ok } from '../lib/api-response'
import { asyncHandler } from '../utils/async-handler'
import { countAudit, listAudit } from '../services/audit.service'

export const listAuditHandler = asyncHandler(async (req, res) => {
  const limit = Number.parseInt(req.query.limit as string, 10) || 50
  const offset = Number.parseInt(req.query.offset as string, 10) || 0
  const safeLimit = Math.min(Math.max(limit, 1), 200)
  const safeOffset = Math.max(offset, 0)
  const [entries, total] = await Promise.all([listAudit(safeLimit, safeOffset), countAudit()])
  res.json(ok({ entries, total, limit: safeLimit, offset: safeOffset }))
})