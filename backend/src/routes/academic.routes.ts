import { Router } from 'express'
import {
  academicStatsHandler,
  assignClassTeacherHandler,
  assignTeachingAssignmentHandler,
  classTeacherHandler,
  deactivateTeachingAssignmentHandler,
  getTeacherHandler,
  listTeachersHandler,
  listTeachingAssignmentsHandler,
  removeClassTeacherHandler,
  teacherPortalHandler,
} from '../controllers/academic.controller.js'
import { requireAuth } from '../middleware/require-auth.js'
import { requirePermission } from '../middleware/require-permission.js'
import { validate } from '../middleware/validate.js'
import { classTeacherAssignSchema, teachingAssignmentCreateSchema } from '../schemas/index.js'

const router = Router()

router.use(requireAuth)

router.get('/stats', requirePermission('academic.view'), academicStatsHandler)
router.get('/me', requirePermission('academic.view', 'sba.view', 'teachers.view'), teacherPortalHandler)
router.get('/teachers', requirePermission('teachers.view'), listTeachersHandler)
router.get('/teachers/:id', requirePermission('teachers.view'), getTeacherHandler)
router.get('/assignments', requirePermission('teachers.view'), listTeachingAssignmentsHandler)
router.post('/assignments', requirePermission('assignments.manage'), validate(teachingAssignmentCreateSchema), assignTeachingAssignmentHandler)
router.post('/assignments/:id/deactivate', requirePermission('assignments.manage'), deactivateTeachingAssignmentHandler)
router.get('/classes/:classId/class-teacher', requirePermission('teachers.view'), classTeacherHandler)
router.put('/classes/:classId/class-teacher', requirePermission('assignments.manage'), validate(classTeacherAssignSchema), assignClassTeacherHandler)
router.delete('/classes/:classId/class-teacher', requirePermission('assignments.manage'), removeClassTeacherHandler)

export const academicRouter = router