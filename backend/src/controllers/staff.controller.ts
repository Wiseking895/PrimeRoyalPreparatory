import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  assignRole,
  createStaff,
  getStaff,
  getStaffStats,
  listStaff,
  removeRole,
  resendStaffInvitation,
  setStaffStatus,
  updateStaff,
} from '../services/staff.service'

export const listStaffHandler = asyncHandler(async (req, res) => {
  const status = req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE' ? req.query.status : undefined
  const staff = await listStaff({
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    category: typeof req.query.category === 'string' ? req.query.category : undefined,
    position: typeof req.query.position === 'string' ? req.query.position : undefined,
    status,
  })
  res.json(ok(staff))
})

export const getStaffHandler = asyncHandler(async (req, res) => {
  const staff = await getStaff(req.params.id)
  res.json(ok(staff))
})

export const createStaffHandler = asyncHandler(async (req: AuthRequest, res) => {
  const result = await createStaff(req.user!, req.body, req.ip)
  res.status(HttpStatus.Created).json(ok(result, 'Staff account created and invitation sent successfully.'))
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

export const resendStaffInvitationHandler = asyncHandler(async (req: AuthRequest, res) => {
  const result = await resendStaffInvitation(req.user!, req.params.id, req.ip)
  res.json(ok(result, 'Staff invitation re-sent successfully.'))
})

export const staffStatsHandler = asyncHandler(async (_req, res) => {
  const stats = await getStaffStats()
  res.json(ok(stats))
})

export const assignRoleHandler = asyncHandler(async (req: AuthRequest, res) => {
  const staff = await assignRole(req.user!, req.params.id, req.body.roleName, req.ip)
  res.json(ok(staff, 'Staff role assigned successfully.'))
})

export const removeRoleHandler = asyncHandler(async (req: AuthRequest, res) => {
  const staff = await removeRole(req.user!, req.params.id, req.ip)
  res.json(ok(staff, 'Staff role removed successfully.'))
})