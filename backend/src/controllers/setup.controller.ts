import { HttpStatus } from '../config/enums.js'
import { env } from '../config/env.js'
import { signToken } from '../lib/jwt.js'
import { ok } from '../lib/api-response.js'
import { asyncHandler } from '../utils/async-handler.js'
import { createOwner, ownerExists } from '../services/setup.service.js'

export const setupStatusHandler = asyncHandler(async (_req, res) => {
  const exists = await ownerExists()
  res.json(
    ok(
      { ownerExists: exists, googleOAuthEnabled: env.googleOAuthEnabled },
      exists ? 'Initial owner setup is complete.' : 'Initial owner setup is available.',
    ),
  )
})

/**
 * First-time Owner creation. Returns the brand-new session so the frontend can
 * continue straight into the Owner dashboard instead of asking for the
 * credentials it has just set up.
 */
export const createOwnerHandler = asyncHandler(async (req, res) => {
  const user = await createOwner(req.body, req.ip)
  res
    .status(HttpStatus.Created)
    .json(ok({ user, token: signToken(user.id) }, 'Owner account created successfully.'))
})
