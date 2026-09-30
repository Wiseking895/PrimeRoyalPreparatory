import { ok } from '../lib/api-response.js'
import type { AuthRequest } from '../types/auth.js'
import { asyncHandler } from '../utils/async-handler.js'
import { groupedPermissionsFor, listRolesFor } from '../services/rbac-catalog.js'

export const listRolesHandler = asyncHandler(async (req: AuthRequest, res) => {
  res.json(ok(listRolesFor(req.user!)))
})

export const listPermissionsHandler = asyncHandler(async (req: AuthRequest, res) => {
  res.json(ok(groupedPermissionsFor(req.user!)))
})