import { Router } from 'express'
import {
  activateSubjectHandler,
  createSubjectHandler,
  deactivateSubjectHandler,
  getSubjectHandler,
  listSubjectsHandler,
  updateSubjectHandler,
} from '../controllers/subject.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import { validate } from '../middleware/validate'
import { subjectCreateSchema, subjectUpdateSchema } from '../schemas'

const router = Router()

router.use(requireAuth)

router.get('/', requirePermission('subjects.view'), listSubjectsHandler)
router.post('/', requirePermission('subjects.manage'), validate(subjectCreateSchema), createSubjectHandler)
router.get('/:id', requirePermission('subjects.view'), getSubjectHandler)
router.patch('/:id', requirePermission('subjects.manage'), validate(subjectUpdateSchema), updateSubjectHandler)
router.post('/:id/activate', requirePermission('subjects.manage'), activateSubjectHandler)
router.post('/:id/deactivate', requirePermission('subjects.manage'), deactivateSubjectHandler)

export const subjectRouter = router