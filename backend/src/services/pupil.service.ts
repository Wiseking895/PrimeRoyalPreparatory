import type { Prisma } from '@prisma/client'
import { HttpStatus } from '../config/enums'
import { prisma } from '../lib/prisma'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'
import { toPupilView, type PupilRecord, type PupilView } from './pupil-mapper'

const pupilInclude = {
  class: { select: { id: true, name: true } },
  guardians: { include: { guardian: true } },
} as const

export type PupilStatus = 'ACTIVE' | 'INACTIVE'
export type PupilGender = 'MALE' | 'FEMALE'

export interface GuardianInput {
  fullName: string
  relationship?: string
  phone?: string
  email?: string
  address?: string
  isPrimary?: boolean
  isEmergency?: boolean
}

export interface PupilCreateInput {
  pupilId?: string
  admissionNumber?: string
  firstName: string
  middleName?: string
  lastName: string
  dateOfBirth: string
  gender: PupilGender
  classId: string
  dateAdmitted?: string
  address?: string
  status?: PupilStatus
  guardians?: GuardianInput[]
}

export interface PupilUpdateInput {
  pupilId?: string
  admissionNumber?: string | null
  firstName?: string
  middleName?: string | null
  lastName?: string
  dateOfBirth?: string
  gender?: PupilGender
  classId?: string
  dateAdmitted?: string
  address?: string | null
  status?: PupilStatus
  guardians?: GuardianInput[]
}

export interface PupilListOptions {
  q?: string
  status?: PupilStatus
  classId?: string
  sortBy?: 'name' | 'dateAdmitted' | 'createdAt' | 'updatedAt'
  order?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

export interface PupilListResult {
  items: PupilView[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

export interface PupilStats {
  total: number
  active: number
  inactive: number
  byClass: Array<{ classId: string; className: string; count: number }>
}

async function nextPupilId(): Promise<string> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const count = await prisma.pupil.count({ where: { pupilId: { startsWith: 'PRPS-PUP-' } } })
    const candidate = `PRPS-PUP-${String(count + attempt + 1).padStart(4, '0')}`
    const existing = await prisma.pupil.findUnique({ where: { pupilId: candidate } })
    if (!existing) return candidate
  }
  throw new AppError('Could not generate a unique pupil ID.', HttpStatus.Conflict)
}

async function assertPupilIdAvailable(pupilId: string, excludeRecordId?: string): Promise<void> {
  const existing = await prisma.pupil.findUnique({ where: { pupilId } })
  if (existing && existing.id !== excludeRecordId) {
    throw new AppError('This pupil ID is already in use by another pupil.', HttpStatus.Conflict)
  }
}

async function assertAdmissionNumberAvailable(
  admissionNumber: string,
  excludeRecordId?: string,
): Promise<void> {
  const existing = await prisma.pupil.findUnique({ where: { admissionNumber } })
  if (existing && existing.id !== excludeRecordId) {
    throw new AppError('This admission number is already in use by another pupil.', HttpStatus.Conflict)
  }
}

/**
 * Resolves (or creates) the shared guardian record for a pupil-guardian link.
 * Existing guardians are matched by email, then by full name + phone, so the
 * same guardian is reused across multiple pupils instead of being duplicated.
 */
async function resolveGuardian(
  tx: Prisma.TransactionClient,
  input: GuardianInput,
): Promise<string> {
  const email = input.email?.trim().toLowerCase()
  if (email) {
    const existing = await tx.guardian.findFirst({ where: { email } })
    if (existing) return existing.id
  }
  const phone = input.phone?.trim()
  if (phone) {
    const existing = await tx.guardian.findFirst({
      where: { fullName: input.fullName.trim(), phone },
    })
    if (existing) return existing.id
  }
  const created = await tx.guardian.create({
    data: {
      fullName: input.fullName.trim(),
      phone: phone || null,
      email: email || null,
      address: input.address?.trim() || null,
    },
  })
  return created.id
}

async function linkGuardians(
  tx: Prisma.TransactionClient,
  pupilId: string,
  guardians: GuardianInput[],
): Promise<void> {
  for (const guardian of guardians) {
    const guardianId = await resolveGuardian(tx, guardian)
    await tx.pupilGuardian.create({
      data: {
        pupilId,
        guardianId,
        relationship: guardian.relationship?.trim() || null,
        isPrimary: guardian.isPrimary ?? false,
        isEmergency: guardian.isEmergency ?? false,
      },
    })
  }
}

export async function listPupils(options: PupilListOptions = {}): Promise<PupilListResult> {
  const {
    q,
    status,
    classId,
    sortBy = 'createdAt',
    order = 'desc',
    page = 1,
    pageSize = 20,
  } = options

  const safePage = Math.max(1, Math.floor(page))
  const safePageSize = Math.min(100, Math.max(1, Math.floor(pageSize)))

  const where: Prisma.PupilWhereInput = {}
  if (status) where.status = status
  if (classId) where.classId = classId
  if (q) {
    where.OR = [
      { pupilId: { contains: q, mode: 'insensitive' } },
      { admissionNumber: { contains: q, mode: 'insensitive' } },
      { firstName: { contains: q, mode: 'insensitive' } },
      { middleName: { contains: q, mode: 'insensitive' } },
      { lastName: { contains: q, mode: 'insensitive' } },
    ]
  }

  const nameOrder: Prisma.PupilOrderByWithRelationInput[] =
    sortBy === 'name'
      ? [{ firstName: order }, { lastName: order }]
      : [{ [sortBy]: order }, { createdAt: 'desc' }]

  const [total, records] = await Promise.all([
    prisma.pupil.count({ where }),
    prisma.pupil.findMany({
      where,
      include: pupilInclude,
      orderBy: nameOrder,
      skip: (safePage - 1) * safePageSize,
      take: safePageSize,
    }),
  ])

  return {
    items: records.map((record) => toPupilView(record as PupilRecord)),
    total,
    page: safePage,
    pageSize: safePageSize,
    hasMore: (safePage - 1) * safePageSize + records.length < total,
  }
}

export async function getPupil(id: string): Promise<PupilView> {
  const pupil = await prisma.pupil.findUnique({ where: { id }, include: pupilInclude })
  if (!pupil) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }
  return toPupilView(pupil as PupilRecord)
}

export async function createPupil(
  actor: AuthenticatedUser,
  input: PupilCreateInput,
  ip?: string,
): Promise<PupilView> {
  const classRecord = await prisma.schoolClass.findUnique({ where: { id: input.classId } })
  if (!classRecord) {
    throw new AppError('Please select a valid class.', HttpStatus.BadRequest)
  }

  const pupilId = input.pupilId?.trim() || (await nextPupilId())
  await assertPupilIdAvailable(pupilId)

  const admissionNumber = input.admissionNumber?.trim() || null
  if (admissionNumber) {
    await assertAdmissionNumberAvailable(admissionNumber)
  }

  const pupil = await prisma.$transaction(async (tx) => {
    const created = await tx.pupil.create({
      data: {
        pupilId,
        admissionNumber,
        firstName: input.firstName.trim(),
        middleName: input.middleName?.trim() || null,
        lastName: input.lastName.trim(),
        dateOfBirth: new Date(input.dateOfBirth),
        gender: input.gender,
        classId: input.classId,
        dateAdmitted: input.dateAdmitted ? new Date(input.dateAdmitted) : new Date(),
        status: input.status ?? 'ACTIVE',
        address: input.address?.trim() || null,
      },
    })
    await linkGuardians(tx, created.id, input.guardians ?? [])
    return created
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'pupil.create',
    resourceType: 'pupil',
    resourceId: pupil.id,
    metadata: { pupilId },
    ip: ip ?? null,
  })

  return getPupil(pupil.id)
}

export async function updatePupil(
  actor: AuthenticatedUser,
  id: string,
  input: PupilUpdateInput,
  ip?: string,
): Promise<PupilView> {
  const existing = await prisma.pupil.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }

  const data: Prisma.PupilUpdateInput = {}
  const changed: string[] = []

  if (input.pupilId !== undefined) {
    const pupilId = input.pupilId.trim()
    await assertPupilIdAvailable(pupilId, id)
    data.pupilId = pupilId
    changed.push('pupilId')
  }
  if (input.admissionNumber !== undefined) {
    const admissionNumber = input.admissionNumber?.trim() || null
    if (admissionNumber) await assertAdmissionNumberAvailable(admissionNumber, id)
    data.admissionNumber = admissionNumber
    changed.push('admissionNumber')
  }
  if (input.firstName !== undefined) {
    data.firstName = input.firstName.trim()
    changed.push('firstName')
  }
  if (input.middleName !== undefined) {
    data.middleName = input.middleName?.trim() || null
    changed.push('middleName')
  }
  if (input.lastName !== undefined) {
    data.lastName = input.lastName.trim()
    changed.push('lastName')
  }
  if (input.dateOfBirth !== undefined) {
    data.dateOfBirth = new Date(input.dateOfBirth)
    changed.push('dateOfBirth')
  }
  if (input.gender !== undefined) {
    data.gender = input.gender
    changed.push('gender')
  }
  if (input.classId !== undefined) {
    const classRecord = await prisma.schoolClass.findUnique({ where: { id: input.classId } })
    if (!classRecord) {
      throw new AppError('Please select a valid class.', HttpStatus.BadRequest)
    }
    data.class = { connect: { id: input.classId } }
    if (input.classId !== existing.classId) changed.push('class')
  }
  if (input.dateAdmitted !== undefined) {
    data.dateAdmitted = new Date(input.dateAdmitted)
    changed.push('dateAdmitted')
  }
  if (input.address !== undefined) {
    data.address = input.address?.trim() || null
    changed.push('address')
  }
  if (input.status !== undefined) {
    data.status = input.status
    changed.push('status')
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.pupil.update({ where: { id }, data })
    }
    if (input.guardians !== undefined) {
      await tx.pupilGuardian.deleteMany({ where: { pupilId: id } })
      await linkGuardians(tx, id, input.guardians)
      changed.push('guardians')
    }
  })

  if (changed.length > 0) {
    await recordAudit({
      actorUserId: actor.id,
      action: 'pupil.update',
      resourceType: 'pupil',
      resourceId: id,
      metadata: { changed },
      ip: ip ?? null,
    })
  }

  return getPupil(id)
}

export async function setPupilStatus(
  actor: AuthenticatedUser,
  id: string,
  status: PupilStatus,
  ip?: string,
): Promise<PupilView> {
  const existing = await prisma.pupil.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Pupil record not found.', HttpStatus.NotFound)
  }

  if (existing.status !== status) {
    await prisma.pupil.update({ where: { id }, data: { status } })
    await recordAudit({
      actorUserId: actor.id,
      action: status === 'ACTIVE' ? 'pupil.activate' : 'pupil.deactivate',
      resourceType: 'pupil',
      resourceId: id,
      metadata: { pupilId: existing.pupilId },
      ip: ip ?? null,
    })
  }

  return getPupil(id)
}

/**
 * Aggregate pupil statistics for the dashboards, including an active-pupil
 * count broken down by class.
 */
export async function getPupilStats(): Promise<PupilStats> {
  const [total, active, inactive, byClass] = await Promise.all([
    prisma.pupil.count(),
    prisma.pupil.count({ where: { status: 'ACTIVE' } }),
    prisma.pupil.count({ where: { status: 'INACTIVE' } }),
    prisma.pupil.groupBy({ by: ['classId'], _count: { _all: true } }),
  ])

  const classIds = byClass.map((row) => row.classId)
  const classes = await prisma.schoolClass.findMany({
    where: { id: { in: classIds } },
    select: { id: true, name: true },
  })
  const classMap = new Map(classes.map((entry) => [entry.id, entry.name]))

  const rows = byClass.map((row) => ({
    classId: row.classId,
    className: classMap.get(row.classId) ?? '—',
    count: row._count._all,
  }))
  rows.sort((a, b) => a.className.localeCompare(b.className))

  return { total, active, inactive, byClass: rows }
}
