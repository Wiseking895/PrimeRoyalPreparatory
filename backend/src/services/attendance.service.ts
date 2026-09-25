import { type Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'
import { AppError } from '../utils/app-error'

export interface AttendanceListOptions {
  pupilId?: string
  status?: string
  staffId?: string
  sessionId?: string
  classId?: string
  dateFrom?: string
  dateTo?: string
}

export interface AttendanceView {
  id: string
  pupilId: string | null
  pupilFullName: string | null
  staffId: string
  staffFullName: string
  date: Date
  status: string
  sessionId?: string | null
  classId?: string | null
  notes?: string | null
  createdAt: Date
}

export interface AttendanceCreateInput {
  pupilId?: string
  staffId: string
  status: string
  date: string
  sessionId?: string
  classId?: string
  notes?: string
}

export interface AttendanceUpdateInput {
  status?: string
  date?: string
  notes?: string
}

/**
 * Check if a given date's financial reconciliation is locked.
 * If locked, throws 409 Conflict.
 */
async function assertReconciliationNotLocked(date: Date): Promise<void> {
  const dateOnly = new Date(date.toISOString().slice(0, 10) + 'T00:00:00.000Z')
  const close = await prisma.dailyReconciliationClose.findUnique({
    where: { date: dateOnly },
  })
  if (close) {
    throw new AppError(
      'This day\'s financial reconciliation has already been closed and signed and cannot be changed.',
      409,
    )
  }
}

export async function listAttendance(options: AttendanceListOptions = {}): Promise<AttendanceView[]> {
  const {
    pupilId,
    status,
    staffId,
    sessionId,
    classId,
    dateFrom,
    dateTo,
  } = options

  const where: Prisma.AttendanceWhereInput = {}

  if (pupilId) {
    where.pupilId = pupilId
  }
  if (status) {
    where.status = status
  }
  if (staffId) {
    where.staffId = staffId
  }
  if (sessionId) {
    where.sessionId = sessionId
  }
  if (classId) {
    where.classId = classId
  }
  if (dateFrom || dateTo) {
    const dateFilter: Prisma.DateTimeFilter<'Attendance'> = {}
    if (dateFrom) {
      dateFilter.gte = new Date(dateFrom)
    }
    if (dateTo) {
      dateFilter.lte = new Date(dateTo)
    }
    where.date = dateFilter
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      pupil: { select: { firstName: true, lastName: true, pupilId: true } },
      staff: { select: { fullName: true } },
    },
    orderBy: { date: 'desc' },
  })

  return records.map((r) => ({
    id: r.id,
    pupilId: r.pupilId,
    pupilFullName: r.pupil ? `${r.pupil.firstName} ${r.pupil.lastName}` : null,
    staffId: r.staffId,
    staffFullName: r.staff.fullName,
    date: r.date,
    status: r.status,
    sessionId: r.sessionId,
    classId: r.classId,
    notes: r.notes,
    createdAt: r.createdAt,
  }))
}

export async function getAttendance(id: string): Promise<AttendanceView> {
  const record = await prisma.attendance.findUnique({
    where: { id },
    include: {
      pupil: { select: { firstName: true, lastName: true, pupilId: true } },
      staff: { select: { fullName: true } },
    },
  })
  if (!record) {
    throw new Error('Attendance record not found.')
  }
  return {
    id: record.id,
    pupilId: record.pupilId,
    pupilFullName: record.pupil ? `${record.pupil.firstName} ${record.pupil.lastName}` : null,
    staffId: record.staffId,
    staffFullName: record.staff.fullName,
    date: record.date,
    status: record.status,
    sessionId: record.sessionId,
    classId: record.classId,
    notes: record.notes,
    createdAt: record.createdAt,
  }
}

export async function createAttendance(input: AttendanceCreateInput): Promise<AttendanceView> {
  const { pupilId, staffId, status, date, sessionId, classId, notes } = input

  if (pupilId) {
    const pupilExists = await prisma.pupil.findUnique({ where: { id: pupilId } })
    if (!pupilExists || pupilExists.status !== 'ACTIVE') {
      throw new Error('Invalid pupil.')
    }
  }

  // Check if this day's reconciliation is locked
  await assertReconciliationNotLocked(new Date(date))

  const record = await prisma.attendance.create({
    data: {
      pupilId: pupilId ?? null,
      staffId,
      status,
      date: new Date(date),
      sessionId: sessionId ?? null,
      classId: classId ?? null,
      notes: notes ?? null,
    },
    include: {
      pupil: { select: { firstName: true, lastName: true, pupilId: true } },
      staff: { select: { fullName: true } },
    },
  })

  return {
    id: record.id,
    pupilId: record.pupilId,
    pupilFullName: record.pupil ? `${record.pupil.firstName} ${record.pupil.lastName}` : null,
    staffId: record.staffId,
    staffFullName: record.staff.fullName,
    date: record.date,
    status: record.status,
    sessionId: record.sessionId,
    classId: record.classId,
    notes: record.notes,
    createdAt: record.createdAt,
  }
}

export async function updateAttendance(
  id: string,
  input: AttendanceUpdateInput,
): Promise<AttendanceView> {
  const { status, date, notes } = input

  const existing = await prisma.attendance.findUnique({ where: { id } })
  if (!existing) {
    throw new Error('Attendance record not found.')
  }

  // Check if this day's reconciliation is locked
  const effectiveDate = date ? new Date(date) : existing.date
  await assertReconciliationNotLocked(effectiveDate)

  const record = await prisma.attendance.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(date ? { date: new Date(date) } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    include: {
      pupil: { select: { firstName: true, lastName: true, pupilId: true } },
      staff: { select: { fullName: true } },
    },
  })

  return {
    id: record.id,
    pupilId: record.pupilId,
    pupilFullName: record.pupil ? `${record.pupil.firstName} ${record.pupil.lastName}` : null,
    staffId: record.staffId,
    staffFullName: record.staff.fullName,
    date: record.date,
    status: record.status,
    sessionId: record.sessionId,
    classId: record.classId,
    notes: record.notes,
    createdAt: record.createdAt,
  }
}
