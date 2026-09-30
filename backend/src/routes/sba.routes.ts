import { Router } from 'express'
import {
  getSbaRecordHandler,
  listSbaHandler,
  sbaBulkHandler,
  sbaEntryDataHandler,
  updateSbaRecordHandler,
} from '../controllers/sba.controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requirePermission } from '../middleware/require-permission.js'
import { validate } from '../middleware/validate.js'
import { sbaBulkUpsertSchema, sbaUpdateSchema } from '../schemas/index.js'

const router = Router()

router.use(requireAuth)

router.get('/', requirePermission('sba.view'), listSbaHandler)
router.get('/entry-data', requirePermission('sba.view'), sbaEntryDataHandler)
router.post('/bulk', requirePermission('sba.manage'), validate(sbaBulkUpsertSchema), sbaBulkHandler)
router.get('/:id', requirePermission('sba.view'), getSbaRecordHandler)
router.patch('/:id', requirePermission('sba.manage'), validate(sbaUpdateSchema), updateSbaRecordHandler)

export const sbaRouter = router