import { Router } from 'express'
import {
  getWorkOutputHandler,
  listWorkOutputForReviewHandler,
  getWorkOutputDetailHandler,
  gradeWorkOutputHandler,
  reviewWorkOutputHandler,
} from '../controllers/work-output.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'

const router = Router()

router.use(requireAuth)

// Summary view — available to Owner and Headteacher
router.get('/', requirePermission('owner.manage', 'teachers.view'), getWorkOutputHandler)

// Work output list for review — Headteacher operational access
router.get('/review', requirePermission('owner.manage', 'teachers.view'), listWorkOutputForReviewHandler)

// Single record detail — Owner and Headteacher
router.get('/:id', requirePermission('owner.manage', 'teachers.view'), getWorkOutputDetailHandler)

// Grade a submission — Headteacher only ( Owner also allowed for read-only path)
router.post('/:id/grade', requirePermission('owner.manage', 'teachers.manage'), gradeWorkOutputHandler)

// Mark as reviewed — Headteacher only
router.post('/:id/review', requirePermission('owner.manage', 'teachers.manage'), reviewWorkOutputHandler)

export const workOutputRouter = router
