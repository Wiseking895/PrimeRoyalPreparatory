import { Prisma } from '@prisma/client'
import { HttpStatus } from '../config/enums'
import { prisma } from '../lib/prisma'
import { staffPositionByKey } from '../rbac/catalog'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import { isHeadteacher, isOwner } from './rbac-guards'

/**
 * Phase 6 academic domain service — teachers, class teachers and subject
 * (teaching) assignments.
 *
 * A teacher is an existing staff member holding a teaching position; there is
 * no separate teacher table. Eligibility for academic assignments is enforced
 * here (server-side), never in the frontend: only staff with a teaching
 * position (Class Teacher, Subject Teacher, Assistant Headteacher) who are
 * ACTIVE may be assigned.
 *
 * Assignments are revoked by deactivation (never deleted) so history and the
 * audit trail survive; SBA records never reference assignments, so revoking an
 * assignment can never destroy assessment history.
 */

/** Positions eligible for academic assignments (class teacher / subject teacher). */
export const TEACHING_ASSIGNABLE_POSITIONS = ['CLASS_TEACHER', 'SUBJECT_TEACHER', 'ASSISTANT_HEADTEACHER'] as const

export type AcademicStatus = 'ACTIVE' | 'INACTIVE'

export interface TeacherAssignmentView {
  id: string
  teacherId: string
  subjectId: string
  subjectCode: string
  subjectName: string
  classId: string
  className: string
  status: AcademicStatus
  pupilCount: number
  sbaEnteredCount: number
  createdAt: string
}

export interface TeacherView {
  id: string
  fullName: string
  email: string
  phone: string | null
  status: 'ACTIVE' | 'INACTIVE'
  staffId: string
  category: string | null
  position: string | null
  positionLabel: string
  roleNames: string[]
  assignmentCount: number
  classTeacherClassCount: number
  sbaRecordCount: number
  classesAsClassTeacher: Array<{ classId: string; className: string; pupilCount: number }>
  teachingAssignments: TeacherAssignmentView[]
  createdAt: string
}

export interface ClassTeacherView {
  id: string
  classId: string
  className: string
  teacherId: string
  teacherName: string
  createdAt: string
}

export interface TeachingAssignmentCreateInput {
  teacherId: string
  subjectId: string
  classId: string
}

export interface TeachingAssignmentListOptions {
  teacherId?: string
  subjectId?: string
  classId?: string
  status?: AcademicStatus
}

export interface TeacherPortalView {
  teacher: {
    id: string
    fullName: string
    email: string
    phone: string | null
    staffId: string
    position: string | null
    positionLabel: string
  }
  classesAsClassTeacher: Array<{ classId: string; className: string; pupilCount: number }>
  teachingAssignments: TeacherAssignmentView[]
  sba: {
    totalEntered: number
    recordsCurrentTerm: number
  }
  recentSba: Array<{
    id: string
    pupilName: string
    subjectName: string
    className: string
    termName: string
    score: string
    maxScore: string
    updatedAt: string
  }>
}

export interface AcademicStatsView {
  teachers: { total: number; active: number; inactive: number }
  classes: number
  subjects: { total: number; active: number }
  assignments: { total: number; active: number }
  classTeachersAssigned: number
  sba: { total: number; recordsCurrentTerm: number }
}

const teachingPositionFilter = { position: { in: TEACHING_ASSIGNABLE_POSITIONS as unknown as string[] } }

export function isEligibleTeacherPosition(position: string | null | undefined): boolean {
  if (!position) return false
  return (TEACHING_ASSIGNABLE_POSITIONS as readonly string[]).includes(position)
}

async function assertEligibleTeacher(userId: string): Promise<{ id: string; fullName: string }> {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { staffProfile: true } })
  if (!user || !user.staffProfile) {
    throw new AppError('Teacher not found.', HttpStatus.NotFound)
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError('Cannot assign an inactive staff member.', HttpStatus.BadRequest)
  }
  if (!isEligibleTeacherPosition(user.staffProfile.position)) {
    throw new AppError('This staff member is not an eligible teaching staff member.', HttpStatus.BadRequest)
  }
  return { id: user.id, fullName: user.fullName }
}

// =============================================================================
// Teachers
// =============================================================================

export async function listTeachers(options: { q?: string; status?: 'ACTIVE' | 'INACTIVE' } = {}): Promise<
  Array<Pick<TeacherView, 'id' | 'fullName' | 'email' | 'phone' | 'status' | 'staffId' | 'position' | 'positionLabel' | 'roleNames' | 'assignmentCount' | 'classTeacherClassCount' | 'sbaRecordCount'>>
> {
  const where: Prisma.UserWhereInput = {
    staffProfile: { is: teachingPositionFilter },
    ...(options.status ? { status: options.status } : {}),
    ...(options.q
      ? {
          OR: [
            { fullName: { contains: options.q, mode: 'insensitive' } },
            { email: { contains: options.q, mode: 'insensitive' } },
            { staffProfile: { is: { staffId: { contains: options.q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  }
  const users = await prisma.user.findMany({
    where,
    include: {
      staffProfile: { select: { staffId: true, position: true, category: true } },
      roles: { include: { role: { select: { name: true } } } },
      _count: { select: { teachingAssignments: true, classTeachers: true, sbaRecords: true } },
    },
    orderBy: { fullName: 'asc' },
  })
  return users.map((user) => ({
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    staffId: user.staffProfile?.staffId ?? '—',
    position: user.staffProfile?.position ?? null,
    positionLabel: staffPositionByKey(user.staffProfile?.position)?.label ?? 'Teaching Staff',
    roleNames: user.roles.map(({ role }) => role.name),
    assignmentCount: user._count.teachingAssignments,
    classTeacherClassCount: user._count.classTeachers,
    sbaRecordCount: user._count.sbaRecords,
  }))
}

export async function getTeacher(id: string): Promise<TeacherView> {
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      staffProfile: true,
      roles: { include: { role: { select: { name: true } } } },
      classTeachers: { include: { class: { select: { id: true, name: true, _count: { select: { pupils: true } } } } } },
      teachingAssignments: {
        include: {
          subject: { select: { id: true, code: true, name: true } },
          class: { select: { id: true, name: true, _count: { select: { pupils: true } } } },
        },
      },
      _count: { select: { sbaRecords: true } },
    },
  })
  if (!user || !user.staffProfile) {
    throw new AppError('Teacher not found.', HttpStatus.NotFound)
  }

  const pairs = user.teachingAssignments.map((assignment) => ({
    subjectId: assignment.subjectId,
    classId: assignment.classId,
  }))
  const sbaCounts = await countSbaForPairs(pairs)

  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    status: user.status,
    staffId: user.staffProfile.staffId,
    category: user.staffProfile.category,
    position: user.staffProfile.position,
    positionLabel: staffPositionByKey(user.staffProfile.position)?.label ?? 'Teaching Staff',
    roleNames: user.roles.map(({ role }) => role.name),
    assignmentCount: user.teachingAssignments.length,
    classTeacherClassCount: user.classTeachers.length,
    sbaRecordCount: user._count.sbaRecords,
    classesAsClassTeacher: user.classTeachers.map((row) => ({
      classId: row.class.id,
      className: row.class.name,
      pupilCount: row.class._count.pupils,
    })),
    teachingAssignments: user.teachingAssignments.map((assignment) => ({
      id: assignment.id,
      teacherId: user.id,
      subjectId: assignment.subjectId,
      subjectCode: assignment.subject.code,
      subjectName: assignment.subject.name,
      classId: assignment.classId,
      className: assignment.class.name,
      status: assignment.status,
      pupilCount: assignment.class._count.pupils,
      sbaEnteredCount: sbaCounts.get(`${assignment.subjectId}|${assignment.classId}`) ?? 0,
      createdAt: assignment.createdAt.toISOString(),
    })),
    createdAt: user.createdAt.toISOString(),
  }
}

async function countSbaForPairs(pairs: Array<{ subjectId: string; classId: string }>): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  if (pairs.length === 0) return map
  const rows = await prisma.sbaRecord.groupBy({
    by: ['subjectId', 'classId'],
    where: {
      subjectId: { in: pairs.map((pair) => pair.subjectId) },
      classId: { in: pairs.map((pair) => pair.classId) },
    },
    _count: { _all: true },
  })
  for (const row of rows) {
    map.set(`${row.subjectId}|${row.classId}`, row._count._all)
  }
  return map
}

// =============================================================================
// Class teacher assignment
// =============================================================================

export async function getClassTeacher(classId: string): Promise<ClassTeacherView | null> {
  const row = await prisma.classTeacher.findUnique({
    where: { classId },
    include: {
      class: { select: { name: true } },
      teacher: { select: { fullName: true } },
    },
  })
  if (!row) return null
  return {
    id: row.id,
    classId: row.classId,
    className: row.class.name,
    teacherId: row.teacherId,
    teacherName: row.teacher.fullName,
    createdAt: row.createdAt.toISOString(),
  }
}

export async function assignClassTeacher(
  actor: AuthenticatedUser,
  classId: string,
  teacherId: string,
  ip?: string,
): Promise<ClassTeacherView> {
  const klass = await prisma.schoolClass.findUnique({ where: { id: classId } })
  if (!klass) {
    throw new AppError('Class not found.', HttpStatus.NotFound)
  }
  await assertEligibleTeacher(teacherId)

  const existing = await prisma.classTeacher.findUnique({ where: { classId } })
  const action = existing
    ? existing.teacherId === teacherId
      ? 'academic.class_teacher.assign'
      : 'academic.class_teacher.change'
    : 'academic.class_teacher.assign'

  const row = await prisma.classTeacher.upsert({
    where: { classId },
    update: { teacherId, assignedBy: actor.id },
    create: { classId, teacherId, assignedBy: actor.id },
  })

  await recordAudit({
    actorUserId: actor.id,
    action,
    resourceType: 'classTeacher',
    resourceId: row.id,
    metadata: {
      classId,
      className: klass.name,
      teacherId,
      previousTeacherId: existing?.teacherId ?? null,
    },
    ip: ip ?? null,
  })

  return (await getClassTeacher(classId))!
}

export async function removeClassTeacher(
  actor: AuthenticatedUser,
  classId: string,
  ip?: string,
): Promise<void> {
  const klass = await prisma.schoolClass.findUnique({ where: { id: classId }, select: { id: true, name: true } })
  if (!klass) {
    throw new AppError('Class not found.', HttpStatus.NotFound)
  }
  const existing = await prisma.classTeacher.findUnique({ where: { classId } })
  if (!existing) {
    throw new AppError('This class does not have a class teacher assigned.', HttpStatus.BadRequest)
  }
  await prisma.classTeacher.delete({ where: { classId } })
  await recordAudit({
    actorUserId: actor.id,
    action: 'academic.class_teacher.remove',
    resourceType: 'classTeacher',
    resourceId: existing.id,
    metadata: { classId, className: klass.name, teacherId: existing.teacherId },
    ip: ip ?? null,
  })
}

// =============================================================================
// Teaching (subject teacher) assignments
// =============================================================================

const assignmentInclude = {
  teacher: { select: { id: true, fullName: true } },
  subject: { select: { id: true, code: true, name: true } },
  class: { select: { id: true, name: true, _count: { select: { pupils: true } } } },
} as const

export async function getTeachingAssignment(id: string): Promise<TeacherAssignmentView> {
  const assignment = await prisma.teachingAssignment.findUnique({ where: { id }, include: assignmentInclude })
  if (!assignment) {
    throw new AppError('Teaching assignment not found.', HttpStatus.NotFound)
  }
  const counts = await countSbaForPairs([{ subjectId: assignment.subjectId, classId: assignment.classId }])
  return {
    id: assignment.id,
    teacherId: assignment.teacherId,
    subjectId: assignment.subjectId,
    subjectCode: assignment.subject.code,
    subjectName: assignment.subject.name,
    classId: assignment.classId,
    className: assignment.class.name,
    status: assignment.status,
    pupilCount: assignment.class._count.pupils,
    sbaEnteredCount: counts.get(`${assignment.subjectId}|${assignment.classId}`) ?? 0,
    createdAt: assignment.createdAt.toISOString(),
  }
}

export async function listTeachingAssignments(options: TeachingAssignmentListOptions = {}): Promise<TeacherAssignmentView[]> {
  const where: Prisma.TeachingAssignmentWhereInput = {}
  if (options.teacherId) where.teacherId = options.teacherId
  if (options.subjectId) where.subjectId = options.subjectId
  if (options.classId) where.classId = options.classId
  if (options.status) where.status = options.status

  const assignments = await prisma.teachingAssignment.findMany({
    where,
    include: assignmentInclude,
    orderBy: [{ class: { name: 'asc' } }, { subject: { name: 'asc' } }],
  })
  const pairs = assignments.map((assignment) => ({ subjectId: assignment.subjectId, classId: assignment.classId }))
  const counts = await countSbaForPairs(pairs)
  return assignments.map((assignment) => ({
    id: assignment.id,
    teacherId: assignment.teacherId,
    subjectId: assignment.subjectId,
    subjectCode: assignment.subject.code,
    subjectName: assignment.subject.name,
    classId: assignment.classId,
    className: assignment.class.name,
    status: assignment.status,
    pupilCount: assignment.class._count.pupils,
    sbaEnteredCount: counts.get(`${assignment.subjectId}|${assignment.classId}`) ?? 0,
    createdAt: assignment.createdAt.toISOString(),
  }))
}

export async function assignTeachingAssignment(
  actor: AuthenticatedUser,
  input: TeachingAssignmentCreateInput,
  ip?: string,
): Promise<TeacherAssignmentView> {
  const { teacherId, subjectId, classId } = input

  const [klass, subject] = await Promise.all([
    prisma.schoolClass.findUnique({ where: { id: classId } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
  ])
  if (!klass) {
    throw new AppError('Class not found.', HttpStatus.NotFound)
  }
  if (!subject) {
    throw new AppError('Subject not found.', HttpStatus.NotFound)
  }
  if (klass.status !== 'ACTIVE') {
    throw new AppError('Cannot assign a teacher to an inactive class.', HttpStatus.BadRequest)
  }
  if (subject.status !== 'ACTIVE') {
    throw new AppError('Cannot assign a teacher to an inactive subject.', HttpStatus.BadRequest)
  }
  await assertEligibleTeacher(teacherId)

  const existing = await prisma.teachingAssignment.findUnique({
    where: { teacherId_subjectId_classId: { teacherId, subjectId, classId } },
  })
  const action = existing
    ? existing.status === 'ACTIVE'
      ? 'academic.assignment.reassign'
      : 'academic.assignment.reactivate'
    : 'academic.assignment.assign'

  const record = await prisma.teachingAssignment.upsert({
    where: { teacherId_subjectId_classId: { teacherId, subjectId, classId } },
    update: { status: 'ACTIVE' },
    create: { teacherId, subjectId, classId, status: 'ACTIVE' },
  })

  await recordAudit({
    actorUserId: actor.id,
    action,
    resourceType: 'teachingAssignment',
    resourceId: record.id,
    metadata: {
      teacherId,
      subjectId,
      classId,
      className: klass.name,
      subjectCode: subject.code,
      subjectName: subject.name,
    },
    ip: ip ?? null,
  })

  return getTeachingAssignment(record.id)
}

export async function deactivateTeachingAssignment(
  actor: AuthenticatedUser,
  id: string,
  ip?: string,
): Promise<TeacherAssignmentView> {
  const assignment = await prisma.teachingAssignment.findUnique({
    where: { id },
    include: { subject: { select: { name: true } }, class: { select: { name: true } } },
  })
  if (!assignment) {
    throw new AppError('Teaching assignment not found.', HttpStatus.NotFound)
  }

  if (assignment.status === 'ACTIVE') {
    await prisma.teachingAssignment.update({ where: { id }, data: { status: 'INACTIVE' } })
    await recordAudit({
      actorUserId: actor.id,
      action: 'academic.assignment.deactivate',
      resourceType: 'teachingAssignment',
      resourceId: id,
      metadata: {
        teacherId: assignment.teacherId,
        subjectId: assignment.subjectId,
        classId: assignment.classId,
        subjectName: assignment.subject.name,
        className: assignment.class.name,
      },
      ip: ip ?? null,
    })
  }

  return getTeachingAssignment(id)
}

// =============================================================================
// Statistics + teacher portal
// =============================================================================

export async function getAcademicStats(): Promise<AcademicStatsView> {
  const activeTerm = await prisma.academicTerm.findFirst({
    where: { session: { status: 'ACTIVE' }, status: 'ACTIVE' },
    orderBy: { termNumber: 'desc' },
    select: { id: true },
  })

  const [teachers, classes, subjects, assignments, classTeachersAssigned, sba] = await Promise.all([
    prisma.user.findMany({
      where: { staffProfile: { is: teachingPositionFilter } },
      select: { status: true },
    }),
    prisma.schoolClass.count(),
    prisma.subject.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.teachingAssignment.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.classTeacher.count(),
    prisma.sbaRecord.count(),
  ])

  const subjectCounts = Object.fromEntries(subjects.map((row) => [row.status, row._count._all])) as Record<string, number>
  const assignmentCounts = Object.fromEntries(assignments.map((row) => [row.status, row._count._all])) as Record<string, number>

  const activeTeachers = teachers.filter((user) => user.status === 'ACTIVE').length

  const recordsCurrentTerm = activeTerm
    ? await prisma.sbaRecord.count({ where: { termId: activeTerm.id } })
    : 0

  return {
    teachers: {
      total: teachers.length,
      active: activeTeachers,
      inactive: teachers.length - activeTeachers,
    },
    classes,
    subjects: {
      total: (subjectCounts['ACTIVE'] ?? 0) + (subjectCounts['INACTIVE'] ?? 0),
      active: subjectCounts['ACTIVE'] ?? 0,
    },
    assignments: {
      total: (assignmentCounts['ACTIVE'] ?? 0) + (assignmentCounts['INACTIVE'] ?? 0),
      active: assignmentCounts['ACTIVE'] ?? 0,
    },
    classTeachersAssigned,
    sba: { total: sba, recordsCurrentTerm },
  }
}

export async function getTeacherPortal(actor: AuthenticatedUser): Promise<TeacherPortalView> {
  const user = await prisma.user.findUnique({
    where: { id: actor.id },
    include: { staffProfile: true },
  })
  if (!user) {
    throw new AppError('Staff account not found.', HttpStatus.NotFound)
  }

  const [classTeacherRows, assignments, recentSba, sbaEntered] = await Promise.all([
    prisma.classTeacher.findMany({
      where: { teacherId: actor.id },
      include: { class: { select: { id: true, name: true, _count: { select: { pupils: true } } } } },
    }),
    prisma.teachingAssignment.findMany({
      where: { teacherId: actor.id, status: 'ACTIVE' },
      include: assignmentInclude,
    }),
    prisma.sbaRecord.findMany({
      where: { teacherId: actor.id },
      include: {
        pupil: { select: { firstName: true, lastName: true } },
        subject: { select: { name: true } },
        class: { select: { name: true } },
        term: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
    prisma.sbaRecord.count({ where: { teacherId: actor.id } }),
  ])

  const pairs = assignments.map((assignment) => ({ subjectId: assignment.subjectId, classId: assignment.classId }))
  const sbaCounts = await countSbaForPairs(pairs)

  const activeTerm = await prisma.academicTerm.findFirst({
    where: { session: { status: 'ACTIVE' }, status: 'ACTIVE' },
    orderBy: { termNumber: 'desc' },
    select: { id: true },
  })
  const recordsCurrentTerm = activeTerm
    ? await prisma.sbaRecord.count({ where: { teacherId: actor.id, termId: activeTerm.id } })
    : 0

  return {
    teacher: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      staffId: user.staffProfile?.staffId ?? '—',
      position: user.staffProfile?.position ?? null,
      positionLabel: staffPositionByKey(user.staffProfile?.position)?.label ?? 'Teaching Staff',
    },
    classesAsClassTeacher: classTeacherRows.map((row) => ({
      classId: row.class.id,
      className: row.class.name,
      pupilCount: row.class._count.pupils,
    })),
    teachingAssignments: assignments.map((assignment) => ({
      id: assignment.id,
      teacherId: actor.id,
      subjectId: assignment.subjectId,
      subjectCode: assignment.subject.code,
      subjectName: assignment.subject.name,
      classId: assignment.classId,
      className: assignment.class.name,
      status: assignment.status,
      pupilCount: assignment.class._count.pupils,
      sbaEnteredCount: sbaCounts.get(`${assignment.subjectId}|${assignment.classId}`) ?? 0,
      createdAt: assignment.createdAt.toISOString(),
    })),
    sba: { totalEntered: sbaEntered, recordsCurrentTerm },
    recentSba: recentSba.map((record) => ({
      id: record.id,
      pupilName: `${record.pupil.firstName} ${record.pupil.lastName}`.trim(),
      subjectName: record.subject.name,
      className: record.class.name,
      termName: record.term.name,
      score: new Prisma.Decimal(record.score).toFixed(2),
      maxScore: new Prisma.Decimal(record.maxScore).toFixed(2),
      updatedAt: record.updatedAt.toISOString(),
    })),
  }
}

/** True when the actor has unrestricted academic oversight (Owner or Headteacher). */
export function hasAcademicOversight(actor: AuthenticatedUser): boolean {
  return isOwner(actor) || isHeadteacher(actor)
}