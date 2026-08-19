import { HttpStatus } from '../config/enums'
import { DEFAULT_CLASSES } from '../config/constants'
import { prisma } from '../lib/prisma'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'

export type ClassStatus = 'ACTIVE' | 'INACTIVE'

export interface ClassView {
  id: string
  key: string
  name: string
  description: string | null
  sortOrder: number
  status: ClassStatus
  pupilCount: number
  activePupilCount: number
  createdAt: string
  updatedAt: string
}

export interface ClassCreateInput {
  key: string
  name: string
  description?: string
  sortOrder?: number
  status?: ClassStatus
}

export interface ClassUpdateInput {
  key?: string
  name?: string
  description?: string | null
  sortOrder?: number
  status?: ClassStatus
}

function toClassView(record: {
  id: string
  key: string
  name: string
  description: string | null
  sortOrder: number
  status: ClassStatus
  createdAt: Date
  updatedAt: Date
  _count?: { pupils?: number }
  pupils?: Array<{ status: ClassStatus }>
}): ClassView {
  let pupilCount = 0
  let activePupilCount = 0
  if (record._count?.pupils !== undefined) {
    pupilCount = record._count.pupils
  } else if (Array.isArray(record.pupils)) {
    pupilCount = record.pupils.length
    activePupilCount = record.pupils.filter((pupil) => pupil.status === 'ACTIVE').length
  }

  return {
    id: record.id,
    key: record.key,
    name: record.name,
    description: record.description,
    sortOrder: record.sortOrder,
    status: record.status,
    pupilCount,
    activePupilCount,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function assertKeyAvailable(key: string, excludeId?: string): Promise<void> {
  const existing = await prisma.schoolClass.findUnique({ where: { key } })
  if (existing && existing.id !== excludeId) {
    throw new AppError('A class with this key already exists.', HttpStatus.Conflict)
  }
}

async function assertNameAvailable(name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.schoolClass.findUnique({ where: { name } })
  if (existing && existing.id !== excludeId) {
    throw new AppError('A class with this name already exists.', HttpStatus.Conflict)
  }
}

/**
 * Idempotently ensures the default class levels exist. Runs on backend startup
 * and via `db:seed`, so a fresh deployment always has a usable class structure
 * that the school can then extend or rename through the class management API.
 */
export async function ensureInitialClasses(): Promise<void> {
  for (const klass of DEFAULT_CLASSES) {
    await prisma.schoolClass.upsert({
      where: { key: klass.key },
      update: {
        name: klass.name,
        description: klass.description,
        sortOrder: klass.sortOrder,
      },
      create: {
        key: klass.key,
        name: klass.name,
        description: klass.description,
        sortOrder: klass.sortOrder,
      },
    })
  }
}

export async function listClasses(): Promise<ClassView[]> {
  const classes = await prisma.schoolClass.findMany({
    include: { _count: { select: { pupils: true } } },
    orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
  })
  return classes.map(toClassView)
}

export async function getClass(id: string): Promise<ClassView> {
  const klass = await prisma.schoolClass.findUnique({
    where: { id },
    include: { pupils: { select: { status: true } } },
  })
  if (!klass) {
    throw new AppError('Class not found.', HttpStatus.NotFound)
  }
  return toClassView(klass)
}

export async function createClass(
  actor: AuthenticatedUser,
  input: ClassCreateInput,
  ip?: string,
): Promise<ClassView> {
  const key = input.key.trim()
  await assertKeyAvailable(key)
  await assertNameAvailable(input.name.trim())

  const created = await prisma.schoolClass.create({
    data: {
      key,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      sortOrder: input.sortOrder ?? 0,
      status: input.status ?? 'ACTIVE',
    },
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'class.create',
    resourceType: 'class',
    resourceId: created.id,
    metadata: { key, name: created.name },
    ip: ip ?? null,
  })

  return getClass(created.id)
}

export async function updateClass(
  actor: AuthenticatedUser,
  id: string,
  input: ClassUpdateInput,
  ip?: string,
): Promise<ClassView> {
  const existing = await prisma.schoolClass.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Class not found.', HttpStatus.NotFound)
  }

  const data: Record<string, unknown> = {}
  const changed: string[] = []

  if (input.key !== undefined) {
    const key = input.key.trim()
    await assertKeyAvailable(key, id)
    data.key = key
    changed.push('key')
  }
  if (input.name !== undefined) {
    await assertNameAvailable(input.name.trim(), id)
    data.name = input.name.trim()
    changed.push('name')
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null
    changed.push('description')
  }
  if (input.sortOrder !== undefined) {
    data.sortOrder = input.sortOrder
    changed.push('sortOrder')
  }
  if (input.status !== undefined) {
    data.status = input.status
    changed.push('status')
  }

  if (Object.keys(data).length === 0) {
    return getClass(id)
  }

  await prisma.schoolClass.update({ where: { id }, data })
  await recordAudit({
    actorUserId: actor.id,
    action: 'class.update',
    resourceType: 'class',
    resourceId: id,
    metadata: { changed },
    ip: ip ?? null,
  })

  return getClass(id)
}

export async function setClassStatus(
  actor: AuthenticatedUser,
  id: string,
  status: ClassStatus,
  ip?: string,
): Promise<ClassView> {
  const existing = await prisma.schoolClass.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Class not found.', HttpStatus.NotFound)
  }

  if (existing.status !== status) {
    await prisma.schoolClass.update({ where: { id }, data: { status } })
    await recordAudit({
      actorUserId: actor.id,
      action: status === 'ACTIVE' ? 'class.activate' : 'class.deactivate',
      resourceType: 'class',
      resourceId: id,
      metadata: { name: existing.name },
      ip: ip ?? null,
    })
  }

  return getClass(id)
}
