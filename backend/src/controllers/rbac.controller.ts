import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import { groupedPermissionsFor, listRolesFor } from '../services/rbac-catalog'

export const listRolesHandler = asyncHandler(async (req: AuthRequest, res) => {
  res.json(ok(listRolesFor(req.user!)))
})

export const listPermissionsHandler = asyncHandler(async (req: AuthRequest, res) => {
  res.json(ok(groupedPermissionsFor(req.user!)))
})