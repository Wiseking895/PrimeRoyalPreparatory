import { Router } from 'express'
import {
  activateHeadteacherHandler,
  createHeadteacherHandler,
  deactivateHeadteacherHandler,
  getHeadteacherHandler,
  headteacherPermissionsHandler,
  listHeadteachersHandler,
  ownerSummaryHandler,
  updateHeadteacherHandler,
} from '../controllers/owner.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import { validate } from '../middleware/validate'
import {
  headteacherCreateSchema,
  headteacherPermissionsSchema,
  headteacherUpdateSchema,
} from '../schemas'

const router = Router()

// Every Owner endpoint requires an authenticated Owner.
router.use(requireAuth, requirePermission('owner.manage'))

router.get('/summary', ownerSummaryHandler)

router.get('/headteacher', listHeadteachersHandler)
router.post('/headteacher', validate(headteacherCreateSchema), createHeadteacherHandler)
router.get('/headteacher/:id', getHeadteacherHandler)
router.patch('/headteacher/:id', validate(headteacherUpdateSchema), updateHeadteacherHandler)
router.post('/headteacher/:id/activate', activateHeadteacherHandler)
router.post('/headteacher/:id/deactivate', deactivateHeadteacherHandler)
router.put(
  '/headteacher/:id/permissions',
  validate(headteacherPermissionsSchema),
  headteacherPermissionsHandler,
)

export const ownerRouter = router