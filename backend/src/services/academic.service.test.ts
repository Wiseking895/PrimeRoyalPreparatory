import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'
import { OWNER_ROLE } from '../rbac/catalog'
import type { AuthenticatedUser } from '../types/auth'
import {
  assignClassTeacher,
  assignTeachingAssignment,
  getClassTeacher,
  listTeachingAssignments,
  removeClassTeacher,
} from './academic.service'

const prismaMock = vi.hoisted(() => ({
  schoolClass: { findUnique: vi.fn() },
  subject: { findUnique: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  classTeacher: { findUnique: vi.fn(), findMany: vi.fn(), upsert: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
  teachingAssignment: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    deleteMany: vi.fn(),
  },
  sbaRecord: { groupBy: vi.fn() },
  auditLog: { create: vi.fn() },
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

const owner: AuthenticatedUser = {
  id: 'owner-1',
  fullName: 'Ada Lovelace',
  email: 'ada@school.edu',
  phone: null,
  status: 'ACTIVE',
  staffId: null,
  roleNames: [OWNER_ROLE],
  permissionKeys: [],
}

function klass(id = 'cls-basic-3', name = 'Basic 3', overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id,
    key: id.toUpperCase(),
    name,
    division: null,
    description: null,
    sortOrder: 1,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

function staffUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'teacher-a',
    fullName: 'John Doe',
    status: 'ACTIVE',
    staffProfile: { staffId: 'STF-0001', position: 'CLASS_TEACHER', category: 'TEACHING' },
    ...overrides,
  }
}

function classTeacherRow(classId = 'cls-basic-3', className = 'Basic 3') {
  return {
    id: `ct-${classId}`,
    classId,
    teacherId: 'teacher-a',
    assignedBy: 'owner-1',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    class: { name: className },
    teacher: { fullName: 'John Doe' },
  }
}

function subjectRow() {
  return { id: 'sub-1', code: 'MATH', name: 'Mathematics', status: 'ACTIVE' }
}

function assignmentRow() {
  return {
    id: 'ta-1',
    teacherId: 'teacher-a',
    subjectId: 'sub-1',
    classId: 'cls-basic-3',
    status: 'ACTIVE',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    teacher: { id: 'teacher-a', fullName: 'John Doe' },
    subject: { id: 'sub-1', code: 'MATH', name: 'Mathematics' },
    class: { id: 'cls-basic-3', name: 'Basic 3', _count: { pupils: 10 } },
  }
}

describe('academic.service assignments', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.schoolClass.findUnique.mockResolvedValue(klass())
    prismaMock.subject.findUnique.mockResolvedValue(subjectRow())
    prismaMock.user.findUnique.mockResolvedValue(staffUser())
    prismaMock.classTeacher.findUnique.mockResolvedValue(null)
    prismaMock.classTeacher.upsert.mockResolvedValue({})
    prismaMock.teachingAssignment.findUnique.mockResolvedValue(null)
    prismaMock.teachingAssignment.findMany.mockResolvedValue([])
    prismaMock.teachingAssignment.upsert.mockResolvedValue({
      id: 'ta-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    })
    prismaMock.sbaRecord.groupBy.mockResolvedValue([])
  })

  // -------------------------------------------------------------------------
  // getClassTeacher — NO assignment = NO class association
  // -------------------------------------------------------------------------

  describe('getClassTeacher', () => {
    it('returns null for a class that has no class-teacher assignment', async () => {
      const result = await getClassTeacher('cls-basic-1')

      expect(result).toBeNull()
      expect(prismaMock.classTeacher.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { classId: 'cls-basic-1' } }),
      )
    })

    it('queries strictly by the requested class id (divisions are separate classes)', async () => {
      prismaMock.classTeacher.findUnique.mockImplementation(
        async ({ where }: { where: { classId: string } }) =>
          where.classId === 'nursery-1a' ? classTeacherRow('nursery-1a', 'Nursery 1A') : null,
      )

      const assigned = await getClassTeacher('nursery-1a')
      const sibling = await getClassTeacher('nursery-1b')

      expect(assigned).toMatchObject({ classId: 'nursery-1a', className: 'Nursery 1A', teacherName: 'John Doe' })
      expect(sibling).toBeNull()
      expect(prismaMock.classTeacher.findMany).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // assignClassTeacher — explicit, single-class writes only
  // -------------------------------------------------------------------------

  describe('assignClassTeacher', () => {
    it('creates an assignment only for the selected class (TEST 3)', async () => {
      prismaMock.classTeacher.findUnique.mockResolvedValueOnce(null).mockResolvedValue(classTeacherRow())

      const result = await assignClassTeacher(owner, 'cls-basic-3', 'teacher-a')

      expect(prismaMock.classTeacher.upsert).toHaveBeenCalledTimes(1)
      expect(prismaMock.classTeacher.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { classId: 'cls-basic-3' },
          create: expect.objectContaining({ classId: 'cls-basic-3', teacherId: 'teacher-a' }),
        }),
      )
      expect(result).toMatchObject({ classId: 'cls-basic-3', teacherId: 'teacher-a', teacherName: 'John Doe' })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'academic.class_teacher.assign' }) }),
      )
    })

    it('assigns the same teacher to a second class without affecting the first (TEST 4)', async () => {
      prismaMock.classTeacher.findUnique.mockResolvedValueOnce(null).mockResolvedValue(classTeacherRow())

      await assignClassTeacher(owner, 'cls-basic-3', 'teacher-a')
      prismaMock.classTeacher.findUnique.mockResolvedValue(null)
      await assignClassTeacher(owner, 'cls-basic-4', 'teacher-a')

      expect(prismaMock.classTeacher.upsert).toHaveBeenCalledTimes(2)
      expect(prismaMock.classTeacher.upsert).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({ where: { classId: 'cls-basic-3' } }),
      )
      expect(prismaMock.classTeacher.upsert).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({ where: { classId: 'cls-basic-4' } }),
      )
      expect(prismaMock.classTeacher.delete).not.toHaveBeenCalled()
      expect(prismaMock.classTeacher.deleteMany).not.toHaveBeenCalled()
    })

    it('assigns only the exact class/division record — Nursery 1A never touches Nursery 1B (TEST 5)', async () => {
      prismaMock.schoolClass.findUnique.mockResolvedValue(klass('nursery-1a', 'Nursery 1A', { division: 'A' }))
      prismaMock.classTeacher.findUnique.mockResolvedValueOnce(null).mockResolvedValue(classTeacherRow('nursery-1a', 'Nursery 1A'))

      await assignClassTeacher(owner, 'nursery-1a', 'teacher-a')

      const upsertCalls = prismaMock.classTeacher.upsert.mock.calls
      expect(upsertCalls).toHaveLength(1)
      expect(upsertCalls[0][0].where).toEqual({ classId: 'nursery-1a' })
      expect(JSON.stringify(upsertCalls)).not.toContain('nursery-1b')
    })

    it('rejects an ineligible staff member and writes nothing', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffUser({ staffProfile: { staffId: 'STF-9', position: 'CLEANER', category: 'NON_TEACHING' } }))

      await expect(assignClassTeacher(owner, 'cls-basic-3', 'teacher-a')).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
      })
      expect(prismaMock.classTeacher.upsert).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // removeClassTeacher — removal never deletes the teacher account
  // -------------------------------------------------------------------------

  describe('removeClassTeacher', () => {
    it('removes only the class-teacher row; the teacher account is untouched (TEST 7)', async () => {
      prismaMock.classTeacher.findUnique.mockResolvedValue(classTeacherRow())

      await removeClassTeacher(owner, 'cls-basic-3')

      expect(prismaMock.classTeacher.delete).toHaveBeenCalledWith({ where: { classId: 'cls-basic-3' } })
      expect(prismaMock.user.delete).not.toHaveBeenCalled()
      expect(prismaMock.user.update).not.toHaveBeenCalled()
      expect(prismaMock.teachingAssignment.delete).not.toHaveBeenCalled()
      expect(prismaMock.teachingAssignment.deleteMany).not.toHaveBeenCalled()
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'academic.class_teacher.remove' }) }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // assignTeachingAssignment — subject-teacher flow, exact tuple only
  // -------------------------------------------------------------------------

  describe('assignTeachingAssignment', () => {
    it('creates exactly one teacher+subject+class assignment', async () => {
      prismaMock.teachingAssignment.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValue(assignmentRow())

      const result = await assignTeachingAssignment(owner, {
        teacherId: 'teacher-a',
        subjectId: 'sub-1',
        classId: 'cls-basic-3',
      })

      expect(prismaMock.teachingAssignment.upsert).toHaveBeenCalledTimes(1)
      expect(prismaMock.teachingAssignment.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            teacherId_subjectId_classId: { teacherId: 'teacher-a', subjectId: 'sub-1', classId: 'cls-basic-3' },
          },
        }),
      )
      expect(result).toMatchObject({ classId: 'cls-basic-3', subjectName: 'Mathematics', status: 'ACTIVE' })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'academic.assignment.assign' }) }),
      )
    })
  })

  // -------------------------------------------------------------------------
  // listTeachingAssignments — only real assignment rows are returned
  // -------------------------------------------------------------------------

  describe('listTeachingAssignments', () => {
    it('returns an empty list when no assignments exist (TEST 1/2 tail)', async () => {
      const result = await listTeachingAssignments()

      expect(result).toEqual([])
      expect(prismaMock.teachingAssignment.findMany).toHaveBeenCalled()
    })

    it('returns only actual assignment rows — never inferred class/teacher links (TEST 6/8)', async () => {
      prismaMock.teachingAssignment.findMany.mockResolvedValue([assignmentRow()])

      const result = await listTeachingAssignments()

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ teacherId: 'teacher-a', className: 'Basic 3' })
    })

    it('scopes to a single class when a classId filter is provided', async () => {
      await listTeachingAssignments({ classId: 'cls-basic-3' })

      expect(prismaMock.teachingAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ classId: 'cls-basic-3' }) }),
      )
    })
  })
})
