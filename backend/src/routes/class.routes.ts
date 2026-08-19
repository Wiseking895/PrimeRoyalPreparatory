import { Router } from 'express'
import {
  activateClassHandler,
  createClassHandler,
  deactivateClassHandler,
  getClassHandler,
  listClassesHandler,
  updateClassHandler,
} from '../controllers/class.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import { validate } from '../middleware/validate'
import { classCreateSchema, classUpdateSchema } from '../schemas'

const router = Router()

router.use(requireAuth)

router.get('/', requirePermission('classes.view'), listClassesHandler)
router.post('/', requirePermission('classes.manage'), validate(classCreateSchema), createClassHandler)
router.get('/:id', requirePermission('classes.view'), getClassHandler)
router.patch('/:id', requirePermission('classes.manage'), validate(classUpdateSchema), updateClassHandler)
router.post('/:id/activate', requirePermission('classes.manage'), activateClassHandler)
router.post('/:id/deactivate', requirePermission('classes.manage'), deactivateClassHandler)

export const classRouter = router