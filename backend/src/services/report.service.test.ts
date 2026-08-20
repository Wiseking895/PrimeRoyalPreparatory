import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedUser } from '../types/auth'
import {
  assertCanViewPupilReport,
  getTerminalReport,
  gradeForPercentage,
  listReportPupils,
  listReportTermsForPupil,
} from './report.service'

const prismaMock = vi.hoisted(() => ({
  pupil: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
  academicTerm: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  academicSession: {
    findMany: vi.fn(),
  },
  sbaRecord: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
  teachingAssignment: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
  classTeacher: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
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
    roleNames: ['HEADTEACHER'],
    permissionKeys: ['reports.view'],
    ...overrides,
  }
}

function pupilRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p-1',
    pupilId: 'PRPS-PUP-0001',
    firstName: 'Ama',
    lastName: 'Owusu',
    status: 'ACTIVE',
    class: { id: 'cls-1', name: 'Class 1' },
    ...overrides,
  }
}

function termRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 't-1',
    name: 'First Term',
    termNumber: 1,
    session: { id: 's-1', name: '2025/2026 Academic Year' },
    ...overrides,
  }
}

function sbaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rec-1',
    pupilId: 'p-1',
    subjectId: 'sub-1',
    classId: 'cls-1',
    termId: 't-1',
    teacherId: 'user-2',
    score: new Prisma.Decimal('85.00'),
    maxScore: new Prisma.Decimal('100.00'),
    comment: null,
    subject: { id: 'sub-1', code: 'MATH', name: 'Mathematics' },
    class: { id: 'cls-1', name: 'Class 1' },
    ...overrides,
  }
}

describe('report.service (Phase 7 — deterministic terminal reports)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.pupil.findUnique.mockResolvedValue(pupilRow())
    prismaMock.academicTerm.findUnique.mockResolvedValue(termRow())
    prismaMock.sbaRecord.findMany.mockResolvedValue([
      sbaRow(),
      sbaRow({
        id: 'rec-2',
        subjectId: 'sub-2',
        subject: { id: 'sub-2', code: 'ENG', name: 'English' },
        score: new Prisma.Decimal('60.00'),
        maxScore: new Prisma.Decimal('80.00'),
      }),
    ])
  })

  describe('gradeForPercentage', () => {
    it('maps percentage bands to grades', () => {
      expect(gradeForPercentage(95)).toEqual({ grade: 'A', label: 'Excellent' })
      expect(gradeForPercentage(80)).toEqual({ grade: 'A', label: 'Excellent' })
      expect(gradeForPercentage(79)).toEqual({ grade: 'B', label: 'Very Good' })
      expect(gradeForPercentage(65)).toEqual({ grade: 'C', label: 'Good' })
      expect(gradeForPercentage(55)).toEqual({ grade: 'D', label: 'Satisfactory' })
      expect(gradeForPercentage(42)).toEqual({ grade: 'E', label: 'Fair' })
      expect(gradeForPercentage(10)).toEqual({ grade: 'F', label: 'Needs Improvement' })
    })
  })

  describe('getTerminalReport', () => {
    it('computes per-subject percentage, grade and totals deterministically', async () => {
      const report = await getTerminalReport('p-1', 't-1')

      expect(report.pupil.fullName).toBe('Ama Owusu')
      expect(report.term.name).toBe('First Term')
      expect(report.session.name).toBe('2025/2026 Academic Year')

      expect(report.subjects).toHaveLength(2)
      const math = report.subjects.find((subject) => subject.subjectCode === 'MATH')
      expect(math).toMatchObject({ score: '85.00', maxScore: '100.00', percentage: 85, grade: 'A' })
      const english = report.subjects.find((subject) => subject.subjectCode === 'ENG')
      expect(english).toMatchObject({ percentage: 75, grade: 'B' })

      expect(report.totalScore).toBe('145.00')
      expect(report.totalMaxScore).toBe('180.00')
      expect(report.averagePercentage).toBe(80)
      expect(report.overallGrade).toBe('A')
      expect(report.complete).toBe(true)
    })

    it('uses SbaRecord.classId for the report class (historical, not current)', async () => {
      prismaMock.sbaRecord.findMany.mockResolvedValue([
        sbaRow({ classId: 'cls-old', class: { id: 'cls-old', name: 'Class 0' } }),
      ])
      const report = await getTerminalReport('p-1', 't-1')
      expect(report.class).toEqual({ id: 'cls-old', name: 'Class 0' })
      expect(report.subjects[0].classId).toBe('cls-old')
    })

    it('returns an incomplete report when the pupil has no SBA for the term', async () => {
      prismaMock.sbaRecord.findMany.mockResolvedValue([])
      const report = await getTerminalReport('p-1', 't-1')
      expect(report.subjects).toEqual([])
      expect(report.complete).toBe(false)
      expect(report.averagePercentage).toBe(0)
      expect(report.overallGrade).toBe('F')
    })

    it('preserves the recorded SBA comment as the remark', async () => {
      prismaMock.sbaRecord.findMany.mockResolvedValue([
        sbaRow({ comment: 'Excellent grasp of fractions.' }),
      ])
      const report = await getTerminalReport('p-1', 't-1')
      expect(report.subjects[0].remark).toBe('Excellent grasp of fractions.')
    })

    it('throws 404 when the pupil or term does not exist', async () => {
      prismaMock.pupil.findUnique.mockResolvedValue(null)
      await expect(getTerminalReport('p-missing', 't-1')).rejects.toThrow('Pupil record not found')
      prismaMock.pupil.findUnique.mockResolvedValue(pupilRow())
      prismaMock.academicTerm.findUnique.mockResolvedValue(null)
      await expect(getTerminalReport('p-1', 't-missing')).rejects.toThrow('Academic term not found')
    })
  })

  describe('listReportTermsForPupil', () => {
    it('marks terms that have a report for the pupil', async () => {
      prismaMock.academicTerm.findMany.mockResolvedValue([
        {
          id: 't-1',
          name: 'First Term',
          termNumber: 1,
          sessionId: 's-1',
          session: { id: 's-1', name: '2025/2026 Academic Year' },
          _count: { sbaRecords: 3 },
        },
        {
          id: 't-2',
          name: 'Second Term',
          termNumber: 2,
          sessionId: 's-1',
          session: { id: 's-1', name: '2025/2026 Academic Year' },
          _count: { sbaRecords: 0 },
        },
      ])
      const terms = await listReportTermsForPupil('p-1', 's-1')
      expect(terms).toEqual([
        expect.objectContaining({ id: 't-1', hasReport: true }),
        expect.objectContaining({ id: 't-2', hasReport: false }),
      ])
    })
  })

  describe('assertCanViewPupilReport', () => {
    it('allows oversight roles unconditionally', async () => {
      await expect(assertCanViewPupilReport(actor(), 'p-1', 't-1')).resolves.toBeUndefined()
      expect(prismaMock.sbaRecord.count).not.toHaveBeenCalled()
    })

    it('allows a teacher with an ACTIVE assignment in the recorded class', async () => {
      const teacher = actor({ roleNames: ['SUBJECT_TEACHER'], permissionKeys: ['sba.view'] })
      prismaMock.sbaRecord.findMany.mockResolvedValue([sbaRow()])
      prismaMock.teachingAssignment.findFirst.mockResolvedValue({ id: 'ta-1' })
      await expect(assertCanViewPupilReport(teacher, 'p-1', 't-1')).resolves.toBeUndefined()
    })

    it('forbids a teacher with no connection to the pupil', async () => {
      const teacher = actor({ roleNames: ['SUBJECT_TEACHER'], permissionKeys: ['sba.view'] })
      prismaMock.sbaRecord.findMany.mockResolvedValue([sbaRow()])
      prismaMock.teachingAssignment.findFirst.mockResolvedValue(null)
      prismaMock.classTeacher.findFirst.mockResolvedValue(null)
      prismaMock.sbaRecord.count.mockResolvedValue(0)
      await expect(assertCanViewPupilReport(teacher, 'p-1', 't-1')).rejects.toThrow('Forbidden')
    })
  })

  describe('listReportPupils', () => {
    it('returns all pupils for an oversight role', async () => {
      prismaMock.pupil.findMany.mockResolvedValue([pupilRow()])
      prismaMock.pupil.count.mockResolvedValue(1)
      const result = await listReportPupils(actor(), {})
      expect(result.items[0]).toMatchObject({ id: 'p-1', fullName: 'Ama Owusu', className: 'Class 1' })
      expect(result.total).toBe(1)
    })

    it('scopes non-oversight staff to their classes and recorded pupils', async () => {
      const teacher = actor({ roleNames: ['CLASS_TEACHER'], permissionKeys: ['sba.view'] })
      prismaMock.teachingAssignment.findMany.mockResolvedValue([{ classId: 'cls-1' }])
      prismaMock.classTeacher.findMany.mockResolvedValue([])
      prismaMock.sbaRecord.findMany.mockResolvedValue([{ pupilId: 'p-9' }])
      prismaMock.pupil.findMany.mockResolvedValue([pupilRow()])
      const result = await listReportPupils(teacher, {})
      expect(result.items).toHaveLength(1)
      expect(prismaMock.pupil.findMany).toHaveBeenCalled()
    })

    it('returns an empty list for a teacher with no scope', async () => {
      const teacher = actor({ roleNames: ['SUBJECT_TEACHER'], permissionKeys: ['sba.view'] })
      prismaMock.teachingAssignment.findMany.mockResolvedValue([])
      prismaMock.classTeacher.findMany.mockResolvedValue([])
      prismaMock.sbaRecord.findMany.mockResolvedValue([])
      const result = await listReportPupils(teacher, {})
      expect(result).toEqual({ items: [], total: 0 })
    })
  })
})