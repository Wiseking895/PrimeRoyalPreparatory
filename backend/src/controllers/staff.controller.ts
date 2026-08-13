import { HttpStatus } from '@prps/shared'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  assignRole,
  createStaff,
  getStaff,
  listStaff,
  removeRole,
  setStaffStatus,
  updateStaff,
} from '../services/staff.service'

export const listStaffHandler = asyncHandler(async (req, res) => {
  const search = typeof req.query.q === 'string' ? req.query.q : undefined
  const staff = await listStaff(search)
  res.json(ok(staff))
})

export const getStaffHandler = asyncHandler(async (req, res) => {
  const staff = await getStaff(req.params.id)
  res.json(ok(staff))
})

export const createStaffHandler = asyncHandler(async (req: AuthRequest, res) => {
  const staff = await createStaff(req.user!, req.body, req.ip)
  res.status(HttpStatus.Created).json(ok(staff, 'Staff account created successfully.'))
})

export const updateStaffHandler = asyncHandler(async (req: AuthRequest, res) => {
  const staff = await updateStaff(req.user!, req.params.id, req.body, req.ip)
  res.json(ok(staff, 'Staff account updated successfully.'))
})

export const activateStaffHandler = asyncHandler(async (req: AuthRequest, res) => {
  const staff = await setStaffStatus(req.user!, req.params.id, 'ACTIVE', req.ip)
  res.json(ok(staff, 'Staff account activated successfully.'))
})

export const deactivateStaffHandler = asyncHandler(async (req: AuthRequest, res) => {
  const staff = await setStaffStatus(req.user!, req.params.id, 'INACTIVE', req.ip)
  res.json(ok(staff, 'Staff account deactivated successfully.'))
})

export const assignRoleHandler = asyncHandler(async (req: AuthRequest, res) => {
  const staff = await assignRole(req.user!, req.params.id, req.body.roleName, req.ip)
  res.json(ok(staff, 'Staff role assigned successfully.'))
})

export const removeRoleHandler = asyncHandler(async (req: AuthRequest, res) => {
  const staff = await removeRole(req.user!, req.params.id, req.ip)
  res.json(ok(staff, 'Staff role removed successfully.'))
})