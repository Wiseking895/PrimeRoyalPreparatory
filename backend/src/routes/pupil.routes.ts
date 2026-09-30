import { Router } from 'express'
import multer from 'multer'
import { MAX_UPLOAD_FILE_BYTES } from '../config/upload.js'
import {
  activatePupilHandler,
  admissionFeeHandler,
  admissionFormPdfHandler,
  createPupilHandler,
  deactivatePupilHandler,
  getPupilHandler,
  listPupilsHandler,
  pupilStatsHandler,
  updatePupilHandler,
} from '../controllers/pupil.controller.js'
import {
  confirmPupilImportHandler,
  downloadImportTemplateHandler,
  previewPupilImportHandler,
} from '../controllers/pupil-import.controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requirePermission } from '../middleware/require-permission.js'
import { validate } from '../middleware/validate.js'
import { pupilCreateSchema, pupilImportConfirmSchema, pupilUpdateSchema } from '../schemas/index.js'

const router = Router()

// In-memory DOCX upload: buffered, never written to disk, discarded after parse.
const docxUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_FILE_BYTES },
})

router.use(requireAuth)

router.get('/', requirePermission('pupils.view'), listPupilsHandler)
router.post('/', requirePermission('pupils.create'), validate(pupilCreateSchema), createPupilHandler)
router.get('/stats', requirePermission('pupils.view'), pupilStatsHandler)
router.get('/admission-fee', requirePermission('pupils.view'), admissionFeeHandler)

// Word admission import (routes registered before "/:id" so "import" is not
// treated as a pupil id). Same permission as manual registration.
router.get('/import/template', requirePermission('pupils.create'), downloadImportTemplateHandler)
router.post(
  '/import/preview',
  requirePermission('pupils.create'),
  docxUpload.single('document'),
  previewPupilImportHandler,
)
router.post(
  '/import/confirm',
  requirePermission('pupils.create'),
  validate(pupilImportConfirmSchema),
  confirmPupilImportHandler,
)

router.get('/:id/admission-form', requirePermission('pupils.view'), admissionFormPdfHandler)
router.get('/:id', requirePermission('pupils.view'), getPupilHandler)
router.patch('/:id', requirePermission('pupils.update'), validate(pupilUpdateSchema), updatePupilHandler)
router.post('/:id/activate', requirePermission('pupils.update'), activatePupilHandler)
router.post('/:id/deactivate', requirePermission('pupils.update'), deactivatePupilHandler)

export const pupilRouter = router
