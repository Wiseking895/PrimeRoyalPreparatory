import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  createClass,
  getClass,
  listClasses,
  setClassStatus,
  updateClass,
} from '../services/class.service'

export const listClassesHandler = asyncHandler(async (_req, res) => {
  const classes = await listClasses()
  res.json(ok(classes))
})

export const getClassHandler = asyncHandler(async (req, res) => {
  const klass = await getClass(req.params.id)
  res.json(ok(klass))
})

export const createClassHandler = asyncHandler(async (req: AuthRequest, res) => {
  const klass = await createClass(req.user!, req.body, req.ip)
  res.status(HttpStatus.Created).json(ok(klass, 'Class created successfully.'))
})

export const updateClassHandler = asyncHandler(async (req: AuthRequest, res) => {
  const klass = await updateClass(req.user!, req.params.id, req.body, req.ip)
  res.json(ok(klass, 'Class updated successfully.'))
})

export const activateClassHandler = asyncHandler(async (req: AuthRequest, res) => {
  const klass = await setClassStatus(req.user!, req.params.id, 'ACTIVE', req.ip)
  res.json(ok(klass, 'Class activated successfully.'))
})

export const deactivateClassHandler = asyncHandler(async (req: AuthRequest, res) => {
  const klass = await setClassStatus(req.user!, req.params.id, 'INACTIVE', req.ip)
  res.json(ok(klass, 'Class deactivated successfully.'))
})