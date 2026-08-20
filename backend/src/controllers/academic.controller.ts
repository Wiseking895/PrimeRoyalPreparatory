import { HttpStatus } from '../config/enums'
import { ok } from '../lib/api-response'
import type { AuthRequest } from '../types/auth'
import { asyncHandler } from '../utils/async-handler'
import {
  assignClassTeacher,
  assignTeachingAssignment,
  deactivateTeachingAssignment,
  getAcademicStats,
  getClassTeacher,
  getTeacher,
  getTeacherPortal,
  listTeachers,
  listTeachingAssignments,
  removeClassTeacher,
} from '../services/academic.service'

export const listTeachersHandler = asyncHandler(async (req, res) => {
  const status = req.query.status === 'ACTIVE' || req.query.status === 'INACTIVE' ? req.query.status : undefined
  const teachers = await listTeachers({
    q: typeof req.query.q === 'string' ? req.query.q : undefined,
    status,
  })
  res.json(ok(teachers))
})

export const getTeacherHandler = asyncHandler(async (req, res) => {
  const teacher = await getTeacher(req.params.id)
  res.json(ok(teacher))
})

export const classTeacherHandler = asyncHandler(async (req, res) => {
  const row = await getClassTeacher(req.params.classId)
  res.json(ok(row))
})

export const assignClassTeacherHandler = asyncHandler(async (req: AuthRequest, res) => {
  const row = await assignClassTeacher(req.user!, req.params.classId, req.body.teacherId, req.ip)
  res.json(ok(row, 'Class teacher assigned successfully.'))
})

export const removeClassTeacherHandler = asyncHandler(async (req: AuthRequest, res) => {
  await removeClassTeacher(req.user!, req.params.classId, req.ip)
  res.json(ok(null, 'Class teacher removed successfully.'))
})

export const listTeachingAssignmentsHandler = asyncHandler(async (req, res) => {
  const { teacherId, subjectId, classId, status } = req.query
  const assignments = await listTeachingAssignments({
    teacherId: typeof teacherId === 'string' ? teacherId : undefined,
    subjectId: typeof subjectId === 'string' ? subjectId : undefined,
    classId: typeof classId === 'string' ? classId : undefined,
    status: status === 'ACTIVE' || status === 'INACTIVE' ? status : undefined,
  })
  res.json(ok(assignments))
})

export const assignTeachingAssignmentHandler = asyncHandler(async (req: AuthRequest, res) => {
  const assignment = await assignTeachingAssignment(req.user!, req.body, req.ip)
  res.status(HttpStatus.Created).json(ok(assignment, 'Teacher assigned successfully.'))
})

export const deactivateTeachingAssignmentHandler = asyncHandler(async (req: AuthRequest, res) => {
  const assignment = await deactivateTeachingAssignment(req.user!, req.params.id, req.ip)
  res.json(ok(assignment, 'Teaching assignment removed successfully.'))
})

export const academicStatsHandler = asyncHandler(async (_req, res) => {
  const stats = await getAcademicStats()
  res.json(ok(stats))
})

export const teacherPortalHandler = asyncHandler(async (req: AuthRequest, res) => {
  const portal = await getTeacherPortal(req.user!)
  res.json(ok(portal))
})