import { Router } from 'express'
import {
  activatePupilHandler,
  createPupilHandler,
  deactivatePupilHandler,
  getPupilHandler,
  listPupilsHandler,
  pupilStatsHandler,
  updatePupilHandler,
} from '../controllers/pupil.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import { validate } from '../middleware/validate'
import { pupilCreateSchema, pupilUpdateSchema } from '../schemas'

const router = Router()

router.use(requireAuth)

router.get('/', requirePermission('pupils.view'), listPupilsHandler)
router.post('/', requirePermission('pupils.create'), validate(pupilCreateSchema), createPupilHandler)
router.get('/stats', requirePermission('pupils.view'), pupilStatsHandler)
router.get('/:id', requirePermission('pupils.view'), getPupilHandler)
router.patch('/:id', requirePermission('pupils.update'), validate(pupilUpdateSchema), updatePupilHandler)
router.post('/:id/activate', requirePermission('pupils.update'), activatePupilHandler)
router.post('/:id/deactivate', requirePermission('pupils.update'), deactivatePupilHandler)

export const pupilRouter = router