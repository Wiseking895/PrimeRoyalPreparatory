import { type Prisma, type WorkOutputType, type WorkOutputReviewStatus } from '@prisma/client'
import { prisma } from '../lib/prisma'

/**
 * Single source of truth for the number of weeks per academic term.
 * Change this constant to adjust the term length across the entire system.
 */
export const WEEKS_PER_TERM = 16

/**
 * Performance grading scale — single source of truth.
 * Score boundaries:
 *   8.0 – 10.0  →  EXCELLENT
 *   6.0 – 7.9   →  VERY_GOOD
 *   5.0 – 5.9   →  GOOD
 *   0.0 – 4.9   →  WEAK
 */
export function classifyScore(score: number): string {
  if (score >= 8.0) return 'EXCELLENT'
  if (score >= 6.0) return 'VERY_GOOD'
  if (score >= 5.0) return 'GOOD'
  return 'WEAK'
}

export function validateScore(score: number): boolean {
  return typeof score === 'number' && !isNaN(score) && score >= 0 && score <= 10
}

export type WorkOutputTypeValue = 'EXERCISE' | 'QUIZ' | 'HOMEWORK' | 'MIDTERM_EXAM'

// ── View DTOs ────────────────────────────────────────────────────────

export interface WorkOutputTeacherSubjectRow {
  teacherId: string
  teacherName: string
  subjectId: string
  subjectName: string
  subjectCode: string
  className: string
  classId: string
  exercises: number
  quizzes: number
  homework: number
  midtermExams: number
}

export interface WorkOutputWeeklyRow {
  weekNumber: number
  exercises: number
  quizzes: number
  homework: number
  midtermExams: number
}

export interface WorkOutputTeacherDetail {
  teacherId: string
  teacherName: string
  subjects: Array<{
    subjectId: string
    subjectName: string
    subjectCode: string
    className: string
    classId: string
    weekly: WorkOutputWeeklyRow[]
    totals: {
      exercises: number
      quizzes: number
      homework: number
      midtermExams: number
    }
  }>
  totals: {
    exercises: number
    quizzes: number
    homework: number
    midtermExams: number
  }
}

export interface WorkOutputSummaryView {
  session: { id: string; name: string } | null
  term: { id: string; name: string; startDate: string; endDate: string } | null
  totals: {
    exercises: number
    quizzes: number
    homework: number
    midtermExams: number
    totalTeachers: number
    totalSubjects: number
  }
  byTeacherSubject: WorkOutputTeacherSubjectRow[]
  byTeacher: WorkOutputTeacherDetail[]
}

// ── Helpers ──────────────────────────────────────────────────────────

function emptyWeekly(): WorkOutputWeeklyRow[] {
  return Array.from({ length: WEEKS_PER_TERM }, (_, i) => ({
    weekNumber: i + 1,
    exercises: 0,
    quizzes: 0,
    homework: 0,
    midtermExams: 0,
  }))
}

function incrementWeekly(
  weekly: WorkOutputWeeklyRow[],
  weekNumber: number,
  workType: WorkOutputType,
): void {
  const idx = weekNumber - 1
  if (idx < 0 || idx >= weekly.length) return
  const row = weekly[idx]
  switch (workType) {
    case 'EXERCISE':
      row.exercises++
      break
    case 'QUIZ':
      row.quizzes++
      break
    case 'HOMEWORK':
      row.homework++
      break
    case 'MIDTERM_EXAM':
      row.midtermExams++
      break
  }
}

// ── Main query ───────────────────────────────────────────────────────

export interface GetWorkOutputOptions {
  sessionId?: string
  termId?: string
  teacherId?: string
  subjectId?: string
  weekNumber?: number
}

export async function getWorkOutput(
  options: GetWorkOutputOptions = {},
): Promise<WorkOutputSummaryView> {
  // Resolve active session/term if not specified
  const session = options.sessionId
    ? await prisma.academicSession.findUnique({
        where: { id: options.sessionId },
        select: { id: true, name: true },
      })
    : await prisma.academicSession.findFirst({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { createdAt: 'desc' },
      })

  const term = options.termId
    ? await prisma.academicTerm.findUnique({
        where: { id: options.termId },
        select: { id: true, name: true, startDate: true, endDate: true },
      })
    : session
      ? await prisma.academicTerm.findFirst({
          where: { sessionId: session.id, status: 'ACTIVE' },
          select: { id: true, name: true, startDate: true, endDate: true },
          orderBy: { termNumber: 'desc' },
        })
      : null

  if (!term) {
    return {
      session,
      term: null,
      totals: {
        exercises: 0,
        quizzes: 0,
        homework: 0,
        midtermExams: 0,
        totalTeachers: 0,
        totalSubjects: 0,
      },
      byTeacherSubject: [],
      byTeacher: [],
    }
  }

  // Build the where clause
  const where: Prisma.WorkOutputRecordWhereInput = {
    termId: term.id,
  }
  if (options.teacherId) where.teacherId = options.teacherId
  if (options.subjectId) where.subjectId = options.subjectId
  if (options.weekNumber) where.weekNumber = options.weekNumber

  // Fetch all matching records
  const records = await prisma.workOutputRecord.findMany({
    where,
    select: {
      teacherId: true,
      teacher: { select: { fullName: true } },
      subjectId: true,
      subject: { select: { name: true, code: true } },
      classId: true,
      class: { select: { name: true } },
      weekNumber: true,
      workType: true,
    },
    orderBy: [{ teacher: { fullName: 'asc' } }, { subject: { name: 'asc' } }, { weekNumber: 'asc' }],
  })

  // Aggregate by teacher+subject
  type TSKey = string // `${teacherId}|${subjectId}|${classId}`
  const byTSMap = new Map<TSKey, {
    teacherId: string
    teacherName: string
    subjectId: string
    subjectName: string
    subjectCode: string
    className: string
    classId: string
    weekly: WorkOutputWeeklyRow[]
    totals: { exercises: number; quizzes: number; homework: number; midtermExams: number }
  }>()

  for (const rec of records) {
    const key: TSKey = `${rec.teacherId}|${rec.subjectId}|${rec.classId}`
    let entry = byTSMap.get(key)
    if (!entry) {
      entry = {
        teacherId: rec.teacherId,
        teacherName: rec.teacher.fullName,
        subjectId: rec.subjectId,
        subjectName: rec.subject.name,
        subjectCode: rec.subject.code,
        className: rec.class.name,
        classId: rec.classId,
        weekly: emptyWeekly(),
        totals: { exercises: 0, quizzes: 0, homework: 0, midtermExams: 0 },
      }
      byTSMap.set(key, entry)
    }

    incrementWeekly(entry.weekly, rec.weekNumber, rec.workType as WorkOutputType)

    switch (rec.workType) {
      case 'EXERCISE':
        entry.totals.exercises++
        break
      case 'QUIZ':
        entry.totals.quizzes++
        break
      case 'HOMEWORK':
        entry.totals.homework++
        break
      case 'MIDTERM_EXAM':
        entry.totals.midtermExams++
        break
    }
  }

  const byTeacherSubject: WorkOutputTeacherSubjectRow[] = [...byTSMap.values()].map((e) => ({
    teacherId: e.teacherId,
    teacherName: e.teacherName,
    subjectId: e.subjectId,
    subjectName: e.subjectName,
    subjectCode: e.subjectCode,
    className: e.className,
    classId: e.classId,
    exercises: e.totals.exercises,
    quizzes: e.totals.quizzes,
    homework: e.totals.homework,
    midtermExams: e.totals.midtermExams,
  }))

  // Aggregate by teacher (across all subjects)
  type TKey = string // teacherId
  const byTeacherMap = new Map<TKey, {
    teacherId: string
    teacherName: string
    subjects: Map<string, WorkOutputTeacherDetail['subjects'][0]>
    totals: { exercises: number; quizzes: number; homework: number; midtermExams: number }
  }>()

  for (const row of byTeacherSubject) {
    let teacher = byTeacherMap.get(row.teacherId)
    if (!teacher) {
      teacher = {
        teacherId: row.teacherId,
        teacherName: row.teacherName,
        subjects: new Map(),
        totals: { exercises: 0, quizzes: 0, homework: 0, midtermExams: 0 },
      }
      byTeacherMap.set(row.teacherId, teacher)
    }

    const subKey = `${row.subjectId}|${row.classId}`
    if (!teacher.subjects.has(subKey)) {
      teacher.subjects.set(subKey, {
        subjectId: row.subjectId,
        subjectName: row.subjectName,
        subjectCode: row.subjectCode,
        className: row.className,
        classId: row.classId,
        weekly: emptyWeekly(),
        totals: { exercises: 0, quizzes: 0, homework: 0, midtermExams: 0 },
      })
    }

    const sub = teacher.subjects.get(subKey)!
    sub.totals.exercises += row.exercises
    sub.totals.quizzes += row.quizzes
    sub.totals.homework += row.homework
    sub.totals.midtermExams += row.midtermExams

    teacher.totals.exercises += row.exercises
    teacher.totals.quizzes += row.quizzes
    teacher.totals.homework += row.homework
    teacher.totals.midtermExams += row.midtermExams
  }

  // Rebuild weekly data per teacher-subject from raw records
  for (const rec of records) {
    const teacher = byTeacherMap.get(rec.teacherId)
    if (!teacher) continue
    const subKey = `${rec.subjectId}|${rec.classId}`
    const sub = teacher.subjects.get(subKey)
    if (!sub) continue
    incrementWeekly(sub.weekly, rec.weekNumber, rec.workType as WorkOutputType)
  }

  const byTeacher: WorkOutputTeacherDetail[] = [...byTeacherMap.values()]
    .sort((a, b) => a.teacherName.localeCompare(b.teacherName))
    .map((t) => ({
      teacherId: t.teacherId,
      teacherName: t.teacherName,
      subjects: [...t.subjects.values()].sort((a, b) => a.subjectName.localeCompare(b.subjectName)),
      totals: t.totals,
    }))

  // Compute grand totals
  const totals = {
    exercises: byTeacherSubject.reduce((s, r) => s + r.exercises, 0),
    quizzes: byTeacherSubject.reduce((s, r) => s + r.quizzes, 0),
    homework: byTeacherSubject.reduce((s, r) => s + r.homework, 0),
    midtermExams: byTeacherSubject.reduce((s, r) => s + r.midtermExams, 0),
    totalTeachers: new Set(byTeacherSubject.map((r) => r.teacherId)).size,
    totalSubjects: new Set(byTeacherSubject.map((r) => r.subjectId)).size,
  }

  return {
    session: session ? { id: session.id, name: session.name } : null,
    term: { id: term.id, name: term.name, startDate: term.startDate.toISOString(), endDate: term.endDate.toISOString() },
    totals,
    byTeacherSubject,
    byTeacher,
  }
}

// ── Work Output Detail View (for review) ────────────────────────────

export interface WorkOutputDetailView {
  id: string
  teacherId: string
  teacherName: string
  subjectId: string
  subjectName: string
  subjectCode: string
  classId: string
  className: string
  termId: string
  termName: string
  weekNumber: number
  workType: string
  title: string | null
  dateGiven: string | null
  reviewStatus: string
  reviewedById: string | null
  reviewedByName: string | null
  reviewedAt: string | null
  score: number | null
  classification: string | null
  feedback: string | null
  createdAt: string
}

export interface WorkOutputListQuery {
  sessionId?: string
  termId?: string
  teacherId?: string
  subjectId?: string
  weekNumber?: number
  reviewStatus?: string
}

export async function listWorkOutputForReview(
  options: WorkOutputListQuery = {},
): Promise<WorkOutputDetailView[]> {
  const session = options.sessionId
    ? await prisma.academicSession.findUnique({ where: { id: options.sessionId }, select: { id: true } })
    : await prisma.academicSession.findFirst({ where: { status: 'ACTIVE' }, select: { id: true }, orderBy: { createdAt: 'desc' } })

  const term = options.termId
    ? await prisma.academicTerm.findUnique({ where: { id: options.termId }, select: { id: true } })
    : session
      ? await prisma.academicTerm.findFirst({ where: { sessionId: session.id, status: 'ACTIVE' }, select: { id: true }, orderBy: { termNumber: 'desc' } })
      : null

  if (!term) return []

  const where: Prisma.WorkOutputRecordWhereInput = { termId: term.id }
  if (options.teacherId) where.teacherId = options.teacherId
  if (options.subjectId) where.subjectId = options.subjectId
  if (options.weekNumber) where.weekNumber = options.weekNumber
  if (options.reviewStatus) where.reviewStatus = options.reviewStatus as WorkOutputReviewStatus

  const records = await prisma.workOutputRecord.findMany({
    where,
    select: {
      id: true,
      teacherId: true,
      teacher: { select: { fullName: true } },
      subjectId: true,
      subject: { select: { name: true, code: true } },
      classId: true,
      class: { select: { name: true } },
      termId: true,
      term: { select: { name: true } },
      weekNumber: true,
      workType: true,
      title: true,
      dateGiven: true,
      reviewStatus: true,
      reviewedById: true,
      reviewedBy: { select: { fullName: true } },
      reviewedAt: true,
      score: true,
      classification: true,
      feedback: true,
      createdAt: true,
    },
    orderBy: [
      { reviewStatus: 'asc' },
      { createdAt: 'desc' },
    ],
  })

  return records.map((r) => ({
    id: r.id,
    teacherId: r.teacherId,
    teacherName: r.teacher.fullName,
    subjectId: r.subjectId,
    subjectName: r.subject.name,
    subjectCode: r.subject.code,
    classId: r.classId,
    className: r.class.name,
    termId: r.termId,
    termName: r.term.name,
    weekNumber: r.weekNumber,
    workType: r.workType,
    title: r.title,
    dateGiven: r.dateGiven?.toISOString() ?? null,
    reviewStatus: r.reviewStatus,
    reviewedById: r.reviewedById,
    reviewedByName: r.reviewedBy?.fullName ?? null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    score: r.score !== null ? Number(r.score) : null,
    classification: r.classification,
    feedback: r.feedback,
    createdAt: r.createdAt.toISOString(),
  }))
}

export async function getWorkOutputDetail(id: string): Promise<WorkOutputDetailView | null> {
  const r = await prisma.workOutputRecord.findUnique({
    where: { id },
    select: {
      id: true,
      teacherId: true,
      teacher: { select: { fullName: true } },
      subjectId: true,
      subject: { select: { name: true, code: true } },
      classId: true,
      class: { select: { name: true } },
      termId: true,
      term: { select: { name: true } },
      weekNumber: true,
      workType: true,
      title: true,
      dateGiven: true,
      reviewStatus: true,
      reviewedById: true,
      reviewedBy: { select: { fullName: true } },
      reviewedAt: true,
      score: true,
      classification: true,
      feedback: true,
      createdAt: true,
    },
  })
  if (!r) return null
  return {
    id: r.id,
    teacherId: r.teacherId,
    teacherName: r.teacher.fullName,
    subjectId: r.subjectId,
    subjectName: r.subject.name,
    subjectCode: r.subject.code,
    classId: r.classId,
    className: r.class.name,
    termId: r.termId,
    termName: r.term.name,
    weekNumber: r.weekNumber,
    workType: r.workType,
    title: r.title,
    dateGiven: r.dateGiven?.toISOString() ?? null,
    reviewStatus: r.reviewStatus,
    reviewedById: r.reviewedById,
    reviewedByName: r.reviewedBy?.fullName ?? null,
    reviewedAt: r.reviewedAt?.toISOString() ?? null,
    score: r.score !== null ? Number(r.score) : null,
    classification: r.classification,
    feedback: r.feedback,
    createdAt: r.createdAt.toISOString(),
  }
}

export interface GradeWorkOutputInput {
  score: number
  feedback?: string
}

export async function gradeWorkOutput(
  reviewerId: string,
  recordId: string,
  input: GradeWorkOutputInput,
): Promise<WorkOutputDetailView> {
  if (!validateScore(input.score)) {
    throw new Error('Score must be between 0.0 and 10.0.')
  }

  const record = await prisma.workOutputRecord.findUnique({ where: { id: recordId } })
  if (!record) {
    throw new Error('Work output record not found.')
  }

  const classification = classifyScore(input.score)

  await prisma.workOutputRecord.update({
    where: { id: recordId },
    data: {
      reviewStatus: 'CONFIRMED',
      reviewedById: reviewerId,
      reviewedAt: new Date(),
      score: input.score,
      classification,
      feedback: input.feedback?.trim() || null,
    },
  })

  const detail = await getWorkOutputDetail(recordId)
  if (!detail) throw new Error('Failed to retrieve graded record.')
  return detail
}

export async function reviewWorkOutput(
  reviewerId: string,
  recordId: string,
): Promise<WorkOutputDetailView> {
  const record = await prisma.workOutputRecord.findUnique({ where: { id: recordId } })
  if (!record) {
    throw new Error('Work output record not found.')
  }

  await prisma.workOutputRecord.update({
    where: { id: recordId },
    data: {
      reviewStatus: 'REVIEWED',
      reviewedById: reviewerId,
      reviewedAt: new Date(),
    },
  })

  const detail = await getWorkOutputDetail(recordId)
  if (!detail) throw new Error('Failed to retrieve reviewed record.')
  return detail
}

export interface WorkOutputReviewSummary {
  totalRecords: number
  pendingReview: number
  reviewed: number
  confirmed: number
  averageScore: number | null
  totalTeachers: number
}
