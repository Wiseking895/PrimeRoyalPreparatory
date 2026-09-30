import { Router } from 'express'
import {
  getPupilReportHandler,
  getPupilReportSessionsHandler,
  getPupilReportTermsHandler,
  listReportPupilsHandler,
} from '../controllers/reports.controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requirePermission } from '../middleware/require-permission.js'

const router = Router()

router.get('/pupils', requireAuth, requirePermission('reports.view', 'sba.view'), listReportPupilsHandler)

router.get(
  '/pupils/:pupilId/reports',
  requireAuth,
  requirePermission('reports.view', 'sba.view'),
  getPupilReportTermsHandler,
)

router.get(
  '/pupils/:pupilId/reports/sessions',
  requireAuth,
  requirePermission('reports.view', 'sba.view'),
  getPupilReportSessionsHandler,
)

router.get(
  '/pupils/:pupilId/reports/terms/:termId',
  requireAuth,
  requirePermission('reports.view', 'sba.view'),
  getPupilReportHandler,
)

export const reportsRouter = router