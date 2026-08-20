import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'
import type { AuthenticatedUser } from '../types/auth'
import {
  getSbaEntryData,
  getSbaRecord,
  listSba,
  updateSbaRecord,
  upsertSbaBulk,
} from './sba.service'

const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn(), findUnique: vi.fn() },
  subject: { findUnique: vi.fn() },
  schoolClass: { findUnique: vi.fn() },
  academicTerm: { findUnique: vi.fn(), findFirst: vi.fn() },
  teachingAssignment: { findMany: vi.fn(), findFirst: vi.fn() },
  classTeacher: { findMany: vi.fn(), findFirst: vi.fn() },
  sbaRecord: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  pupil: { findMany: vi.fn(), findUnique: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

function actor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    fullName: 'Ama Mensah',
    email: 'ama@school.edu',
    phone: null,
    status: 'ACTIVE',
    staffId: 'STF-0001',
    roleNames: ['CLASS_TEACHER'],
    permissionKeys: ['academic.view', 'sba.view', 'sba.manage'],
    ...overrides,
  }
}

function klass() {
  return { id: 'cls-1', name: 'Class 1' }
}

function subject() {
  return { id: 'sub-1', code: 'MATH', name: 'Mathematics' }
}

function term() {
  return { id: 't-1', name: 'First Term', session: { name: '2025/2026 Academic Year' } }
}

function sbaRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    pupilId: 'p-1',
    subjectId: 'sub-1',
    classId: 'cls-1',
    termId: 't-1',
    teacherId: 'user-1',
    score: new Prisma.Decimal('85.50'),
    maxScore: new Prisma.Decimal('100.00'),
    comment: null,
    createdAt: new Date('2026-01-10T00:00:00.000Z'),
    updatedAt: new Date('2026-01-10T00:00:00.000Z'),
    pupil: { id: 'p-1', pupilId: 'PRPS-PUP-0001', firstName: 'Ama', lastName: 'Owusu', status: 'ACTIVE' },
    subject: { id: 'sub-1', code: 'MATH', name: 'Mathematics' },
    class: { id: 'cls-1', name: 'Class 1' },
    term: { id: 't-1', name: 'First Term', termNumber: 1, session: { id: 's-1', name: '2025/2026 Academic Year' } },
    teacher: { id: 'user-1', fullName: 'Ama Mensah' },
    ...overrides,
  }
}

describe('sba.service (Phase 6 — teacher access control + score bounds)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.$transaction.mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') return arg(prismaMock)
      return Promise.resolve(arg)
    })
  })

  describe('getSbaEntryData', () => {
    it('returns 404 when the class does not exist', async () => {
      prismaMock.schoolClass.findUnique.mockResolvedValue(null)
      await expect(
        getSbaEntryData(actor(), { classId: 'cls-1', subjectId: 'sub-1', termId: 't-1' }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.NotFound })
    })

    it('gives manage access to a teacher with an ACTIVE assignment and maps records', async () => {
      prismaMock.schoolClass.findUnique.mockResolvedValue(klass())
      prismaMock.subject.findUnique.mockResolvedValue(subject())
      prismaMock.academicTerm.findUnique.mockResolvedValue(term())
      prismaMock.teachingAssignment.findFirst.mockResolvedValue({ id: 'ta-1' })
      prismaMock.classTeacher.findFirst.mockResolvedValue(null)
      prismaMock.sbaRecord.count.mockResolvedValue(0)
      prismaMock.pupil.findMany.mockResolvedValue([
        { id: 'p-1', pupilId: 'PRPS-PUP-0001', firstName: 'Ama', lastName: 'Owusu', status: 'ACTIVE' },
      ])
      prismaMock.sbaRecord.findMany.mockResolvedValue([sbaRecord()])

      const data = await getSbaEntryData(actor(), { classId: 'cls-1', subjectId: 'sub-1', termId: 't-1' })
      expect(data.access).toBe('manage')
      expect(data.pupils).toHaveLength(1)
      expect(data.pupils[0].record?.score).toBe('85.50')
    })

    it('forbids a teacher with no assignment or history for the class/subject (403)', async () => {
      prismaMock.schoolClass.findUnique.mockResolvedValue(klass())
      prismaMock.subject.findUnique.mockResolvedValue(subject())
      prismaMock.academicTerm.findUnique.mockResolvedValue(term())
      prismaMock.teachingAssignment.findFirst.mockResolvedValue(null)
      prismaMock.classTeacher.findFirst.mockResolvedValue(null)
      prismaMock.sbaRecord.count.mockResolvedValue(0)

      await expect(
        getSbaEntryData(actor(), { classId: 'cls-1', subjectId: 'sub-1', termId: 't-1' }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.Forbidden })
    })
  })

  describe('upsertSbaBulk', () => {
    it('rejects a score that exceeds the maximum score', async () => {
      prismaMock.schoolClass.findUnique.mockResolvedValue(klass())
      prismaMock.subject.findUnique.mockResolvedValue(subject())
      prismaMock.academicTerm.findUnique.mockResolvedValue(term())
      prismaMock.teachingAssignment.findFirst.mockResolvedValue({ id: 'ta-1' })
      prismaMock.pupil.findMany.mockResolvedValue([{ id: 'p-1', classId: 'cls-1' }])

      await expect(
        upsertSbaBulk(actor(), {
          subjectId: 'sub-1',
          classId: 'cls-1',
          termId: 't-1',
          entries: [{ pupilId: 'p-1', score: 120, maxScore: 100 }],
        }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.BadRequest })
    })

    it('rejects a pupil that does not belong to the selected class', async () => {
      prismaMock.schoolClass.findUnique.mockResolvedValue(klass())
      prismaMock.subject.findUnique.mockResolvedValue(subject())
      prismaMock.academicTerm.findUnique.mockResolvedValue(term())
      prismaMock.teachingAssignment.findFirst.mockResolvedValue({ id: 'ta-1' })
      prismaMock.pupil.findMany.mockResolvedValue([{ id: 'p-1', classId: 'cls-2' }])

      await expect(
        upsertSbaBulk(actor(), {
          subjectId: 'sub-1',
          classId: 'cls-1',
          termId: 't-1',
          entries: [{ pupilId: 'p-1', score: 80, maxScore: 100 }],
        }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.BadRequest, message: expect.stringContaining('do not belong') })
    })

    it('forbids a teacher without manage access (403)', async () => {
      prismaMock.schoolClass.findUnique.mockResolvedValue(klass())
      prismaMock.subject.findUnique.mockResolvedValue(subject())
      prismaMock.academicTerm.findUnique.mockResolvedValue(term())
      prismaMock.teachingAssignment.findFirst.mockResolvedValue(null)
      prismaMock.classTeacher.findFirst.mockResolvedValue(null)
      prismaMock.sbaRecord.count.mockResolvedValue(0)
      prismaMock.pupil.findMany.mockResolvedValue([{ id: 'p-1', classId: 'cls-1' }])

      await expect(
        upsertSbaBulk(actor(), {
          subjectId: 'sub-1',
          classId: 'cls-1',
          termId: 't-1',
          entries: [{ pupilId: 'p-1', score: 80, maxScore: 100 }],
        }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.Forbidden })
    })

    it('upserts records and writes an audit entry on success', async () => {
      prismaMock.schoolClass.findUnique.mockResolvedValue(klass())
      prismaMock.subject.findUnique.mockResolvedValue(subject())
      prismaMock.academicTerm.findUnique.mockResolvedValue(term())
      prismaMock.teachingAssignment.findFirst.mockResolvedValue({ id: 'ta-1' })
      prismaMock.pupil.findMany.mockResolvedValue([{ id: 'p-1', classId: 'cls-1' }])
      prismaMock.sbaRecord.upsert.mockResolvedValue({ id: 'rec-1' })
      prismaMock.sbaRecord.findMany.mockResolvedValue([sbaRecord()])

      const result = await upsertSbaBulk(actor(), {
        subjectId: 'sub-1',
        classId: 'cls-1',
        termId: 't-1',
        entries: [{ pupilId: 'p-1', score: 85.5, maxScore: 100, comment: 'Excellent' }],
      })
      expect(result.upserted).toBe(1)
      expect(result.records[0].comment).toBe(null)
      expect(prismaMock.sbaRecord.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { pupilId_subjectId_classId_termId: { pupilId: 'p-1', subjectId: 'sub-1', classId: 'cls-1', termId: 't-1' } },
        }),
      )
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'academic.sba.upsert' }) }),
      )
    })
  })

  describe('updateSbaRecord', () => {
    it('returns 404 when the record does not exist', async () => {
      prismaMock.sbaRecord.findUnique.mockResolvedValue(null)
      await expect(
        updateSbaRecord(actor(), 'rec-x', { score: 90, maxScore: 100 }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.NotFound })
    })

    it('forbids updating a record the teacher does not manage (403)', async () => {
      prismaMock.sbaRecord.findUnique.mockResolvedValue(sbaRecord())
      prismaMock.teachingAssignment.findFirst.mockResolvedValue(null)
      prismaMock.classTeacher.findFirst.mockResolvedValue(null)
      prismaMock.sbaRecord.count.mockResolvedValue(0)

      await expect(
        updateSbaRecord(actor(), 'rec-1', { score: 90, maxScore: 100 }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.Forbidden })
    })

    it('forbids IDOR: a teacher assigned to class/subject A cannot update a record for class/subject B', async () => {
      const otherClassRecord = sbaRecord({
        subjectId: 'sub-2',
        classId: 'cls-2',
        subject: { id: 'sub-2', code: 'ENG', name: 'English' },
        class: { id: 'cls-2', name: 'Class 2' },
      })
      prismaMock.sbaRecord.findUnique.mockResolvedValue(otherClassRecord)
      prismaMock.teachingAssignment.findFirst.mockResolvedValue(null)
      prismaMock.classTeacher.findFirst.mockResolvedValue(null)
      prismaMock.sbaRecord.count.mockResolvedValue(0)

      await expect(
        updateSbaRecord(actor(), 'rec-1', { score: 90, maxScore: 100 }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.Forbidden })
      expect(prismaMock.sbaRecord.update).not.toHaveBeenCalled()
    })

    it('forbids IDOR: a class teacher of class A cannot read class B records (scope uses the record classId)', async () => {
      const foreignRecord = sbaRecord({
        subjectId: 'sub-2',
        classId: 'cls-2',
        teacherId: 'user-99',
        subject: { id: 'sub-2', code: 'ENG', name: 'English' },
        class: { id: 'cls-2', name: 'Class 2' },
      })
      prismaMock.sbaRecord.findUnique.mockResolvedValue(foreignRecord)
      prismaMock.teachingAssignment.findFirst.mockResolvedValue(null)
      prismaMock.classTeacher.findFirst.mockResolvedValue(null)
      prismaMock.sbaRecord.count.mockResolvedValue(0)

      await expect(getSbaRecord(actor(), 'rec-1')).rejects.toMatchObject({ statusCode: HttpStatus.Forbidden })
    })

    it('updates and audits when the teacher manages the subject/class', async () => {
      prismaMock.sbaRecord.findUnique.mockResolvedValue(sbaRecord())
      prismaMock.teachingAssignment.findFirst.mockResolvedValue({ id: 'ta-1' })
      prismaMock.sbaRecord.update.mockResolvedValue({})
      prismaMock.sbaRecord.findMany.mockResolvedValue([sbaRecord()])

      const result = await updateSbaRecord(actor(), 'rec-1', { score: 90, maxScore: 100 })
      expect(result.score).toBe('85.50')
      expect(prismaMock.sbaRecord.update).toHaveBeenCalled()
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'academic.sba.update', resourceId: 'rec-1' }) }),
      )
    })
  })

  describe('listSba scoping', () => {
    it('applies no scope filter for oversight users (Headteacher)', async () => {
      prismaMock.sbaRecord.findMany.mockResolvedValue([])
      await listSba(actor({ roleNames: ['HEADTEACHER'], permissionKeys: ['sba.view'] }), { termId: 't-1' })
      expect(prismaMock.sbaRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { termId: 't-1' } }),
      )
      const call = prismaMock.sbaRecord.findMany.mock.calls[0][0]
      expect(call.where.OR).toBeUndefined()
      expect(call.where.teacherId).toBeUndefined()
    })

    it('scopes reads to the teacher\'s active assignments, class-teacher classes and own records', async () => {
      prismaMock.teachingAssignment.findMany.mockResolvedValue([{ subjectId: 'sub-1', classId: 'cls-1' }])
      prismaMock.classTeacher.findMany.mockResolvedValue([{ classId: 'cls-2' }])
      prismaMock.sbaRecord.findMany.mockResolvedValue([])

      await listSba(actor())
      const call = prismaMock.sbaRecord.findMany.mock.calls[0][0]
      expect(call.where.OR).toEqual(
        expect.arrayContaining([
          { subjectId: 'sub-1', classId: 'cls-1' },
          { classId: { in: ['cls-2'] } },
          { teacherId: 'user-1' },
        ]),
      )
    })
  })
})