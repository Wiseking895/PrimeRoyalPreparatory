import { prisma } from '../lib/prisma'

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
  pupilId: string
  pupilFullName: string
  staffId: string
  staffFullName: string
  date: Date
  status: string
  sessionId?: string
  classId?: string
  notes?: string
  createdAt: Date
}

export interface AttendanceCreateInput {
  pupilId: string
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

  const where: any = {}

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
    where.date = {}
    if (dateFrom) {
      where.date.gte = new Date(dateFrom)
    }
    if (dateTo) {
      where.date.lte = new Date(dateTo)
    }
  }

  const records = await prisma.attendance.findMany({
    where,
    include: {
      pupil: { select: { fullName: true, pupilId: true } },
      staff: { select: { fullName: true, staffProfile: { select: { staffId: true } } } },
    },
    orderBy: { date: 'desc' },
  })

  return records.map((r: any) => ({
    id: r.id,
    pupilId: r.pupilId,
    pupilFullName: r.pupil.fullName,
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
      pupil: { select: { fullName: true, pupilId: true } },
      staff: { select: { fullName: true, staffProfile: { select: { staffId: true } } } },
    },
  })
  if (!record) {
    throw new Error('Attendance record not found.')
  }
  return {
    id: record.id,
    pupilId: record.pupilId,
    pupilFullName: record.pupil.fullName,
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
  const { pupilId, status, date, sessionId, classId, notes } = input

  const pupilExists = await prisma.user.findUnique({ where: { id: pupilId } })
  if (!pupilExists || pupilExists.status !== 'ACTIVE') {
    throw new Error('Invalid pupil.')
  }

  const record = await prisma.attendance.create({
    data: {
      pupilId,
      status,
      date: new Date(date),
      sessionId,
      classId,
      notes,
    },
    include: {
      pupil: { select: { fullName: true, pupilId: true } },
      staff: { select: { fullName: true, staffProfile: { select: { staffId: true } } } },
    },
  })

  return {
    id: record.id,
    pupilId: record.pupilId,
    pupilFullName: record.pupil.fullName,
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

  const record = await prisma.attendance.update({
    where: { id },
    data: {
      ...(status ? { status } : {}),
      ...(date ? { date: new Date(date) } : {}),
      ...(notes !== undefined ? { notes } : {}),
    },
    include: {
      pupil: { select: { fullName: true, pupilId: true } },
      staff: { select: { fullName: true, staffProfile: { select: { staffId: true } } } },
    },
  })

  return {
    id: record.id,
    pupilId: record.pupilId,
    pupilFullName: record.pupil.fullName,
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

export { checkInStaff, getStaffTodayAttendance, listAttendanceRecordsAdmin }