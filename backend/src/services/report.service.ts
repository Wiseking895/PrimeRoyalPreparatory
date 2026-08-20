import { Prisma } from '@prisma/client'
import { HttpStatus } from '../config/enums'
import { prisma } from '../lib/prisma'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { hasAcademicOversight } from './academic.service'

/**
 * Phase 7 Terminal Reports.
 *
 * A terminal report is a deterministic projection of the pupil's School-Based
 * Assessment records for a term. It is never persisted — the SbaRecord rows
 * (which pin pupil + subject + class + term at entry time) are the source of
 * truth, so a report recomputes identically every time and can never drift
 * from the recorded assessments.
 *
 * Aggregation rules:
 *   - Group records by subject (one record per pupil+subject+class+term).
 *   - Class comes from `SbaRecord.classId` (the class the pupil was in when the
 *     assessment was recorded), never from the pupil's current class.
 *   - Per subject: percentage = score ÷ maxScore, graded on the band below.
 *   - Term totals sum raw scores; the overall average is the equal-weighted
 *     mean of subject percentages.
 *
 * The grade band is a school-wide convention documented here; the school can
 * adjust the thresholds in one place.
 */

const GRADE_BANDS: ReadonlyArray<{ min: number; grade: string; label: string }> = [
  { min: 80, grade: 'A', label: 'Excellent' },
  { min: 70, grade: 'B', label: 'Very Good' },
  { min: 60, grade: 'C', label: 'Good' },
  { min: 50, grade: 'D', label: 'Satisfactory' },
  { min: 40, grade: 'E', label: 'Fair' },
  { min: 0, grade: 'F', label: 'Needs Improvement' },
]

export function gradeForPercentage(percentage: number): { grade: string; label: string } {
  const band = GRADE_BANDS.find((entry) => percentage >= entry.min) ?? GRADE_BANDS[GRADE_BANDS.length - 1]
  return { grade: band.grade, label: band.label }
}

export interface ReportSubjectResult {
  subjectId: string
  subjectCode: string
  subjectName: string
  classId: string
  className: string
  score: string
  maxScore: string
  percentage: number
  grade: string
  gradeLabel: string
  remark: string | null
}

export interface TerminalReportView {
  pupil: { id: string; pupilId: string; fullName: string; className: string }
  session: { id: string; name: string }
  term: { id: string; termNumber: number; name: string }
  class: { id: string; name: string } | null
  subjects: ReportSubjectResult[]
  totalScore: string
  totalMaxScore: string
  averagePercentage: number
  overallGrade: string
  overallGradeLabel: string
  complete: boolean
  generatedAt: string
}

export interface ReportPupilRow {
  id: string
  pupilId: string
  fullName: string
  className: string
  status: 'ACTIVE' | 'INACTIVE'
}

export interface ReportTermOption {
  id: string
  name: string
  termNumber: number
  sessionId: string
  sessionName: string
  hasReport: boolean
}

export interface ReportSessionOption {
  id: string
  name: string
  termCount: number
}

export interface ReportPupilListResult {
  items: ReportPupilRow[]
  total: number
}

/** True when the actor may view any pupil's report (Owner, Headteacher, Assistant Headteacher). */
export function hasReportOversight(actor: AuthenticatedUser): boolean {
  return hasAcademicOversight(actor) || actor.permissionKeys.includes('reports.view')
}

function percentageOf(score: Prisma.Decimal, maxScore: Prisma.Decimal): number {
  if (maxScore.lte(0)) return 0
  return Number(score.mul(100).div(maxScore).toFixed(2))
}

function round(number: number, digits: number): number {
  const factor = 10 ** digits
  return Math.round(number * factor) / factor
}

export async function getTerminalReport(
  pupilId: string,
  termId: string,
): Promise<TerminalReportView> {
  const [pupil, term] = await Promise.all([
    prisma.pupil.findUnique({
      where: { id: pupilId },
      select: {
        id: true,
        pupilId: true,
        firstName: true,
        lastName: true,
        class: { select: { id: true, name: true } },
      },
    }),
    prisma.academicTerm.findUnique({
      where: { id: termId },
      select: { id: true, name: true, termNumber: true, session: { select: { id: true, name: true } } },
    }),
  ])
  if (!pupil) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }
  if (!term) {
    throw new AppError('Academic term not found.', HttpStatus.NotFound)
  }

  const records = await prisma.sbaRecord.findMany({
    where: { pupilId, termId },
    include: {
      subject: { select: { id: true, code: true, name: true } },
      class: { select: { id: true, name: true } },
    },
    orderBy: { subject: { name: 'asc' } },
  })

  const subjects: ReportSubjectResult[] = records.map((record) => {
    const percentage = percentageOf(record.score, record.maxScore)
    const band = gradeForPercentage(percentage)
    return {
      subjectId: record.subjectId,
      subjectCode: record.subject.code,
      subjectName: record.subject.name,
      classId: record.classId,
      className: record.class.name,
      score: record.score.toFixed(2),
      maxScore: record.maxScore.toFixed(2),
      percentage,
      grade: band.grade,
      gradeLabel: band.label,
      remark: record.comment ?? band.label,
    }
  })

  const totalScore = subjects.reduce((total, subject) => total.plus(new Prisma.Decimal(subject.score)), new Prisma.Decimal(0))
  const totalMaxScore = subjects.reduce((total, subject) => total.plus(new Prisma.Decimal(subject.maxScore)), new Prisma.Decimal(0))

  const averagePercentage =
    subjects.length > 0 ? round(subjects.reduce((sum, subject) => sum + subject.percentage, 0) / subjects.length, 2) : 0
  const overall = gradeForPercentage(averagePercentage)

  return {
    pupil: {
      id: pupil.id,
      pupilId: pupil.pupilId,
      fullName: `${pupil.firstName} ${pupil.lastName}`.trim(),
      className: pupil.class.name,
    },
    session: { id: term.session.id, name: term.session.name },
    term: { id: term.id, termNumber: term.termNumber, name: term.name },
    class: records.length > 0 ? { id: records[0].classId, name: records[0].class.name } : { id: pupil.class.id, name: pupil.class.name },
    subjects,
    totalScore: totalScore.toFixed(2),
    totalMaxScore: totalMaxScore.toFixed(2),
    averagePercentage,
    overallGrade: overall.grade,
    overallGradeLabel: overall.label,
    complete: records.length > 0,
    generatedAt: new Date().toISOString(),
  }
}

export async function listReportTermsForPupil(
  pupilId: string,
  sessionId?: string,
): Promise<ReportTermOption[]> {
  const pupil = await prisma.pupil.findUnique({ where: { id: pupilId }, select: { id: true } })
  if (!pupil) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }

  const sessionFilter: Prisma.AcademicTermWhereInput = {}
  if (sessionId) sessionFilter.sessionId = sessionId

  const terms = await prisma.academicTerm.findMany({
    where: sessionFilter,
    include: {
      session: { select: { id: true, name: true } },
      _count: { select: { sbaRecords: { where: { pupilId } } } },
    },
    orderBy: [{ session: { startDate: 'asc' } }, { termNumber: 'asc' }],
  })

  return terms.map((term) => ({
    id: term.id,
    name: term.name,
    termNumber: term.termNumber,
    sessionId: term.sessionId,
    sessionName: term.session.name,
    hasReport: term._count.sbaRecords > 0,
  }))
}

export async function listReportSessionsForPupil(pupilId: string): Promise<ReportSessionOption[]> {
  const sessions = await prisma.academicSession.findMany({
    where: { terms: { some: { sbaRecords: { some: { pupilId } } } } },
    include: { _count: { select: { terms: true } } },
    orderBy: { startDate: 'asc' },
  })
  return sessions.map((session) => ({
    id: session.id,
    name: session.name,
    termCount: session._count.terms,
  }))
}

/**
 * Restricts report access for non-oversight staff (class/subject teachers) to
 * pupils they can see SBA for: an ACTIVE teaching assignment in the pupil's
 * recorded class, class-teacher of that class, or a record they recorded.
 */
export async function assertCanViewPupilReport(
  actor: AuthenticatedUser,
  pupilId: string,
  termId: string | null,
): Promise<void> {
  if (hasReportOversight(actor)) return

  const pupil = await prisma.pupil.findUnique({ where: { id: pupilId }, select: { id: true, classId: true } })
  if (!pupil) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }

  const records = await prisma.sbaRecord.findMany({
    where: termId ? { pupilId, termId } : { pupilId },
    select: { classId: true, teacherId: true },
  })
  const classIds = [...new Set(records.map((record) => record.classId))]
  if (classIds.length === 0) classIds.push(pupil.classId)

  const recordedWhere: Prisma.SbaRecordWhereInput = { teacherId: actor.id, pupilId }
  if (termId) recordedWhere.termId = termId

  const [assignment, classTeacher, recorded] = await Promise.all([
    prisma.teachingAssignment.findFirst({
      where: { teacherId: actor.id, classId: { in: classIds }, status: 'ACTIVE' },
      select: { id: true },
    }),
    prisma.classTeacher.findFirst({
      where: { teacherId: actor.id, classId: { in: classIds } },
      select: { id: true },
    }),
    prisma.sbaRecord.count({ where: recordedWhere }),
  ])

  if (!assignment && !classTeacher && recorded === 0) {
    throw new AppError('Forbidden: you do not have permission to view this report.', HttpStatus.Forbidden)
  }
}

export async function listReportPupils(
  actor: AuthenticatedUser,
  options: { q?: string; classId?: string } = {},
): Promise<ReportPupilListResult> {
  const { q, classId } = options

  if (hasReportOversight(actor)) {
    const where: Prisma.PupilWhereInput = {}
    if (classId) where.classId = classId
    if (q) {
      where.OR = [
        { pupilId: { contains: q, mode: 'insensitive' } },
        { firstName: { contains: q, mode: 'insensitive' } },
        { lastName: { contains: q, mode: 'insensitive' } },
      ]
    }
    const [pupils, total] = await Promise.all([
      prisma.pupil.findMany({
        where,
        include: { class: { select: { id: true, name: true } } },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.pupil.count({ where }),
    ])
    return {
      items: pupils.map((entry) => ({
        id: entry.id,
        pupilId: entry.pupilId,
        fullName: `${entry.firstName} ${entry.lastName}`.trim(),
        className: entry.class.name,
        status: entry.status,
      })),
      total,
    }
  }

  const [assignments, classTeacherRows] = await Promise.all([
    prisma.teachingAssignment.findMany({
      where: { teacherId: actor.id, status: 'ACTIVE' },
      select: { classId: true },
    }),
    prisma.classTeacher.findMany({ where: { teacherId: actor.id }, select: { classId: true } }),
  ])
  const recorded = await prisma.sbaRecord.findMany({
    where: { teacherId: actor.id },
    select: { pupilId: true },
  })
  const classIds = [...new Set([...assignments.map((row) => row.classId), ...classTeacherRows.map((row) => row.classId)])]
  const pupilIds = [...new Set(recorded.map((row) => row.pupilId))]

  const where: Prisma.PupilWhereInput = {
    OR: [
      ...(classIds.length > 0 ? [{ classId: { in: classIds } }] : []),
      ...(pupilIds.length > 0 ? [{ id: { in: pupilIds } }] : []),
    ],
  }
  if (where.OR?.length === 0) {
    return { items: [], total: 0 }
  }
  if (classId) where.classId = classId
  if (q) {
    where.AND = [
      {
        OR: [
          { pupilId: { contains: q, mode: 'insensitive' } },
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
        ],
      },
    ]
  }

  const pupils = await prisma.pupil.findMany({
    where,
    include: { class: { select: { id: true, name: true } } },
    orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
  })

  return {
    items: pupils.map((entry) => ({
      id: entry.id,
      pupilId: entry.pupilId,
      fullName: `${entry.firstName} ${entry.lastName}`.trim(),
      className: entry.class.name,
      status: entry.status,
    })),
    total: pupils.length,
  }
}