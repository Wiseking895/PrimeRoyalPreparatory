import { HttpStatus } from '../config/enums'
import { asyncHandler } from '../utils/async-handler'
import { ok } from '../lib/api-response'
import { createOwner, ownerExists } from '../services/setup.service'

export const setupStatusHandler = asyncHandler(async (_req, res) => {
  const exists = await ownerExists()
  res.json(ok({ ownerExists: exists }, exists ? 'Initial owner setup is complete.' : 'Initial owner setup is available.'))
})

export const createOwnerHandler = asyncHandler(async (req, res) => {
  const user = await createOwner(req.body, req.ip)
  res.status(HttpStatus.Created).json(ok(user, 'Owner account created successfully.'))
})