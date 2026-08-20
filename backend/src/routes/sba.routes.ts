import { Router } from 'express'
import {
  getSbaRecordHandler,
  listSbaHandler,
  sbaBulkHandler,
  sbaEntryDataHandler,
  updateSbaRecordHandler,
} from '../controllers/sba.controller'
import { requireAuth } from '../middleware/require-auth'
import { requirePermission } from '../middleware/require-permission'
import { validate } from '../middleware/validate'
import { sbaBulkUpsertSchema, sbaUpdateSchema } from '../schemas'

const router = Router()

router.use(requireAuth)

router.get('/', requirePermission('sba.view'), listSbaHandler)
router.get('/entry-data', requirePermission('sba.view'), sbaEntryDataHandler)
router.post('/bulk', requirePermission('sba.manage'), validate(sbaBulkUpsertSchema), sbaBulkHandler)
router.get('/:id', requirePermission('sba.view'), getSbaRecordHandler)
router.patch('/:id', requirePermission('sba.manage'), validate(sbaUpdateSchema), updateSbaRecordHandler)

export const sbaRouter = router