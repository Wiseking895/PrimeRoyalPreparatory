import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { AppError } from '../utils/app-error'
import { asyncHandler } from '../utils/async-handler'
import {
  buildImportTemplate,
  confirmPupilImport,
  previewPupilImport,
} from '../services/pupil-import.service'

/**
 * Word admission import handlers.
 *
 * Preview parses the upload in memory and returns a validation report —
 * it never creates pupils, guardians or audit rows. Confirm registers the
 * reviewed rows through the existing createPupil service.
 */
export const previewPupilImportHandler = asyncHandler(async (req: AuthRequest, res) => {
  const file = req.file
  if (!file) {
    throw new AppError('Please choose a Word (.docx) document to upload.', HttpStatus.BadRequest)
  }
  const preview = await previewPupilImport(file)
  res.json(ok(preview, 'Document parsed. Review the records below before registering.'))
})

export const confirmPupilImportHandler = asyncHandler(async (req: AuthRequest, res) => {
  const result = await confirmPupilImport(req.user!, req.body.pupils, req.ip)
  res.status(HttpStatus.Created).json(ok(result, 'Import finished.'))
})

export const downloadImportTemplateHandler = asyncHandler(async (_req, res) => {
  const buffer = await buildImportTemplate()
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  res.setHeader('Content-Disposition', 'attachment; filename="PRPS-Pupil-Import-Template.docx"')
  res.setHeader('Content-Length', String(buffer.length))
  res.send(buffer)
})
