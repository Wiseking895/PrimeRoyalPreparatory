import { Prisma } from '@prisma/client'
import { HttpStatus } from '../config/enums'
import { prisma } from '../lib/prisma'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import { hasAcademicOversight } from './academic.service'

/**
 * Phase 6 School-Based Assessment (SBA) service.
 *
 * SBA records pin pupil + subject + class + term at entry time (one aggregate
 * record per term, the natural unit for Phase 7 terminal-report aggregation).
 * They intentionally do NOT reference teaching assignments, so revoking an
 * assignment never destroys assessment history.
 *
 * Teacher access is enforced here, not just at the route level:
 *   - manage scope  → an ACTIVE teaching assignment for (teacher, subject, class)
 *   - view scope    → manage scope, OR class teacher of the class, OR recorded-by
 *   - oversight     → Owner / Headteacher may view and manage any SBA
 */

export interface SbaRecordView {
  id: string
  pupilId: string
  pupilCode: string
  pupilName: string
  pupilStatus: 'ACTIVE' | 'INACTIVE'
  subjectId: string
  subjectCode: string
  subjectName: string
  classId: string
  className: string
  sessionId: string
  sessionName: string
  termId: string
  termName: string
  termNumber: number
  teacherId: string
  teacherName: string
  score: string
  maxScore: string
  comment: string | null
  createdAt: string
  updatedAt: string
}

export interface SbaListOptions {
  sessionId?: string
  termId?: string
  classId?: string
  subjectId?: string
  pupilId?: string
  teacherId?: string
}

export interface SbaEntryInput {
  pupilId: string
  score: number
  maxScore: number
  comment?: string
}

export interface SbaBulkUpsertInput {
  subjectId: string
  classId: string
  termId: string
  entries: SbaEntryInput[]
}

export interface SbaUpdateInput {
  score: number
  maxScore: number
  comment?: string
}

export interface SbaEntryDataView {
  subject: { id: string; code: string; name: string }
  class: { id: string; name: string }
  term: { id: string; name: string; sessionName: string }
  access: 'view' | 'manage'
  pupils: Array<{
    id: string
    pupilId: string
    fullName: string
    status: 'ACTIVE' | 'INACTIVE'
    record: SbaRecordView | null
  }>
}

const sbaInclude = {
  pupil: { select: { id: true, pupilId: true, firstName: true, lastName: true, status: true } },
  subject: { select: { id: true, code: true, name: true } },
  class: { select: { id: true, name: true } },
  term: { select: { id: true, name: true, termNumber: true, session: { select: { id: true, name: true } } } },
  teacher: { select: { id: true, fullName: true } },
} as const

function toSbaView(record: Prisma.SbaRecordGetPayload<{ include: typeof sbaInclude }>): SbaRecordView {
  return {
    id: record.id,
    pupilId: record.pupilId,
    pupilCode: record.pupil.pupilId,
    pupilName: `${record.pupil.firstName} ${record.pupil.lastName}`.trim(),
    pupilStatus: record.pupil.status,
    subjectId: record.subjectId,
    subjectCode: record.subject.code,
    subjectName: record.subject.name,
    classId: record.classId,
    className: record.class.name,
    sessionId: record.term.session.id,
    sessionName: record.term.session.name,
    termId: record.termId,
    termName: record.term.name,
    termNumber: record.term.termNumber,
    teacherId: record.teacherId,
    teacherName: record.teacher.fullName,
    score: new Prisma.Decimal(record.score).toFixed(2),
    maxScore: new Prisma.Decimal(record.maxScore).toFixed(2),
    comment: record.comment,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

function assertScoreBounds(score: Prisma.Decimal, maxScore: Prisma.Decimal): void {
  if (maxScore.lte(0)) {
    throw new AppError('Maximum score must be greater than zero.', HttpStatus.BadRequest)
  }
  if (score.lt(0)) {
    throw new AppError('Score cannot be negative.', HttpStatus.BadRequest)
  }
  if (score.gt(maxScore)) {
    throw new AppError('Score cannot exceed the maximum score.', HttpStatus.BadRequest)
  }
}

/**
 * Resolves the actor's access level for a (subject, class) combination.
 * Returns 'manage', 'view' or 'none'.
 */
export async function assertCanAccessSba(
  actor: AuthenticatedUser,
  subjectId: string,
  classId: string,
): Promise<'view' | 'manage' | 'none'> {
  if (hasAcademicOversight(actor)) return 'manage'

  const [assignment, classTeacher, recorded] = await Promise.all([
    prisma.teachingAssignment.findFirst({
      where: { teacherId: actor.id, subjectId, classId, status: 'ACTIVE' },
      select: { id: true },
    }),
    prisma.classTeacher.findFirst({ where: { teacherId: actor.id, classId }, select: { id: true } }),
    prisma.sbaRecord.count({ where: { teacherId: actor.id, subjectId, classId } }),
  ])

  if (assignment) return 'manage'
  if (classTeacher) return 'view'
  if (recorded > 0) return 'view'
  return 'none'
}

async function assertCanManageSba(actor: AuthenticatedUser, subjectId: string, classId: string): Promise<void> {
  const access = await assertCanAccessSba(actor, subjectId, classId)
  if (access !== 'manage') {
    throw new AppError('Forbidden: you are not assigned to teach this subject in this class.', HttpStatus.Forbidden)
  }
}

/** Prisma where fragment scoping SBA reads to what the actor may view (null = unrestricted). */
async function buildViewScope(actor: AuthenticatedUser): Promise<Prisma.SbaRecordWhereInput | null> {
  if (hasAcademicOversight(actor)) return null

  const [assignments, classTeacherRows] = await Promise.all([
    prisma.teachingAssignment.findMany({
      where: { teacherId: actor.id, status: 'ACTIVE' },
      select: { subjectId: true, classId: true },
    }),
    prisma.classTeacher.findMany({ where: { teacherId: actor.id }, select: { classId: true } }),
  ])

  const conditions: Prisma.SbaRecordWhereInput[] = []
  for (const assignment of assignments) {
    conditions.push({ subjectId: assignment.subjectId, classId: assignment.classId })
  }
  const classTeacherClassIds = classTeacherRows.map((row) => row.classId)
  if (classTeacherClassIds.length > 0) {
    conditions.push({ classId: { in: classTeacherClassIds } })
  }
  conditions.push({ teacherId: actor.id })

  if (conditions.length === 1) return conditions[0]
  return { OR: conditions }
}

// =============================================================================
// Reads
// =============================================================================

export async function listSba(actor: AuthenticatedUser, options: SbaListOptions = {}): Promise<SbaRecordView[]> {
  const scope = await buildViewScope(actor)
  const where: Prisma.SbaRecordWhereInput = { ...(scope ?? {}) }
  if (options.sessionId) where.term = { sessionId: options.sessionId }
  if (options.termId) where.termId = options.termId
  if (options.classId) where.classId = options.classId
  if (options.subjectId) where.subjectId = options.subjectId
  if (options.pupilId) where.pupilId = options.pupilId
  if (options.teacherId) where.teacherId = options.teacherId

  const records = await prisma.sbaRecord.findMany({
    where,
    include: sbaInclude,
    orderBy: [{ term: { termNumber: 'desc' } }, { pupil: { firstName: 'asc' } }],
  })
  return records.map(toSbaView)
}

export async function getSbaRecord(actor: AuthenticatedUser, id: string): Promise<SbaRecordView> {
  const record = await prisma.sbaRecord.findUnique({ where: { id }, include: sbaInclude })
  if (!record) {
    throw new AppError('SBA record not found.', HttpStatus.NotFound)
  }
  const access = await assertCanAccessSba(actor, record.subjectId, record.classId)
  if (access === 'none') {
    throw new AppError('Forbidden: you do not have permission to view this record.', HttpStatus.Forbidden)
  }
  return toSbaView(record)
}

export async function getSbaEntryData(
  actor: AuthenticatedUser,
  options: { classId: string; subjectId: string; termId: string },
): Promise<SbaEntryDataView> {
  const { classId, subjectId, termId } = options
  const [klass, subject, term] = await Promise.all([
    prisma.schoolClass.findUnique({ where: { id: classId } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
    prisma.academicTerm.findUnique({ where: { id: termId }, include: { session: { select: { name: true } } } }),
  ])
  if (!klass) {
    throw new AppError('Class not found.', HttpStatus.NotFound)
  }
  if (!subject) {
    throw new AppError('Subject not found.', HttpStatus.NotFound)
  }
  if (!term) {
    throw new AppError('Academic term not found.', HttpStatus.NotFound)
  }

  const access = await assertCanAccessSba(actor, subjectId, classId)
  if (access === 'none') {
    throw new AppError('Forbidden: you are not assigned to this class and subject.', HttpStatus.Forbidden)
  }

  const [pupils, records] = await Promise.all([
    prisma.pupil.findMany({
      where: { classId, status: 'ACTIVE' },
      select: { id: true, pupilId: true, firstName: true, lastName: true, status: true },
      orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    }),
    prisma.sbaRecord.findMany({ where: { classId, subjectId, termId }, include: sbaInclude }),
  ])

  const byPupil = new Map(records.map((record) => [record.pupilId, toSbaView(record)]))

  return {
    subject: { id: subject.id, code: subject.code, name: subject.name },
    class: { id: klass.id, name: klass.name },
    term: { id: term.id, name: term.name, sessionName: term.session.name },
    access,
    pupils: pupils.map((pupil) => ({
      id: pupil.id,
      pupilId: pupil.pupilId,
      fullName: `${pupil.firstName} ${pupil.lastName}`.trim(),
      status: pupil.status,
      record: byPupil.get(pupil.id) ?? null,
    })),
  }
}

// =============================================================================
// Writes
// =============================================================================

export async function upsertSbaBulk(
  actor: AuthenticatedUser,
  input: SbaBulkUpsertInput,
  ip?: string,
): Promise<{ upserted: number; records: SbaRecordView[] }> {
  const { subjectId, classId, termId, entries } = input

  const [klass, subject, term] = await Promise.all([
    prisma.schoolClass.findUnique({ where: { id: classId } }),
    prisma.subject.findUnique({ where: { id: subjectId } }),
    prisma.academicTerm.findUnique({ where: { id: termId } }),
  ])
  if (!klass) {
    throw new AppError('Class not found.', HttpStatus.NotFound)
  }
  if (!subject) {
    throw new AppError('Subject not found.', HttpStatus.NotFound)
  }
  if (!term) {
    throw new AppError('Academic term not found.', HttpStatus.NotFound)
  }
  await assertCanManageSba(actor, subjectId, classId)

  const pupilIds = [...new Set(entries.map((entry) => entry.pupilId.trim()).filter(Boolean))]
  if (pupilIds.length === 0) {
    throw new AppError('Add at least one pupil score.', HttpStatus.BadRequest)
  }
  const pupils = await prisma.pupil.findMany({
    where: { id: { in: pupilIds } },
    select: { id: true, classId: true },
  })
  if (pupils.length !== pupilIds.length) {
    throw new AppError('One or more selected pupils could not be found.', HttpStatus.BadRequest)
  }
  const wrongClass = pupils.find((pupil) => pupil.classId !== classId)
  if (wrongClass) {
    throw new AppError('One or more pupils do not belong to the selected class.', HttpStatus.BadRequest)
  }

  const entryMap = new Map(entries.map((entry) => [entry.pupilId.trim(), entry]))
  const ids = await prisma.$transaction(async (tx) => {
    const created: string[] = []
    for (const pupil of pupils) {
      const entry = entryMap.get(pupil.id)
      if (!entry) continue
      const score = new Prisma.Decimal(entry.score)
      const maxScore = new Prisma.Decimal(entry.maxScore)
      assertScoreBounds(score, maxScore)
      const record = await tx.sbaRecord.upsert({
        where: { pupilId_subjectId_classId_termId: { pupilId: pupil.id, subjectId, classId, termId } },
        update: {
          score,
          maxScore,
          comment: entry.comment?.trim() || null,
          teacherId: actor.id,
        },
        create: {
          pupilId: pupil.id,
          subjectId,
          classId,
          termId,
          teacherId: actor.id,
          score,
          maxScore,
          comment: entry.comment?.trim() || null,
        },
      })
      created.push(record.id)
    }
    return created
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'academic.sba.upsert',
    resourceType: 'sbaRecord',
    resourceId: null,
    metadata: { subjectId, subjectName: subject.name, classId, className: klass.name, termId, termName: term.name, pupilCount: ids.length },
    ip: ip ?? null,
  })

  const records = await prisma.sbaRecord.findMany({
    where: { id: { in: ids } },
    include: sbaInclude,
    orderBy: { pupil: { firstName: 'asc' } },
  })
  return { upserted: records.length, records: records.map(toSbaView) }
}

export async function updateSbaRecord(
  actor: AuthenticatedUser,
  id: string,
  input: SbaUpdateInput,
  ip?: string,
): Promise<SbaRecordView> {
  const record = await prisma.sbaRecord.findUnique({ where: { id }, include: sbaInclude })
  if (!record) {
    throw new AppError('SBA record not found.', HttpStatus.NotFound)
  }
  await assertCanManageSba(actor, record.subjectId, record.classId)

  const score = new Prisma.Decimal(input.score)
  const maxScore = new Prisma.Decimal(input.maxScore)
  assertScoreBounds(score, maxScore)

  await prisma.sbaRecord.update({
    where: { id },
    data: { score, maxScore, comment: input.comment?.trim() || null, teacherId: actor.id },
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'academic.sba.update',
    resourceType: 'sbaRecord',
    resourceId: id,
    metadata: {
      pupilId: record.pupilId,
      subjectId: record.subjectId,
      classId: record.classId,
      termId: record.termId,
      score: score.toFixed(2),
      maxScore: maxScore.toFixed(2),
    },
    ip: ip ?? null,
  })

  return getSbaRecord(actor, id)
}