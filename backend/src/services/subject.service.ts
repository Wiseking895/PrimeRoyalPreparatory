import type { Prisma } from '@prisma/client'
import { HttpStatus } from '../config/enums'
import { prisma } from '../lib/prisma'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'
import { recordAudit } from './audit.service'

export type SubjectStatus = 'ACTIVE' | 'INACTIVE'

export interface SubjectView {
  id: string
  code: string
  name: string
  description: string | null
  status: SubjectStatus
  assignmentCount: number
  createdAt: string
  updatedAt: string
}

export interface SubjectCreateInput {
  code: string
  name: string
  description?: string
  status?: SubjectStatus
}

export interface SubjectUpdateInput {
  code?: string
  name?: string
  description?: string | null
  status?: SubjectStatus
}

function toSubjectView(record: {
  id: string
  code: string
  name: string
  description: string | null
  status: SubjectStatus
  createdAt: Date
  updatedAt: Date
  _count?: { assignments?: number }
}): SubjectView {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    description: record.description,
    status: record.status,
    assignmentCount: record._count?.assignments ?? 0,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  }
}

async function assertCodeAvailable(code: string, excludeId?: string): Promise<void> {
  const existing = await prisma.subject.findUnique({ where: { code } })
  if (existing && existing.id !== excludeId) {
    throw new AppError('A subject with this code already exists.', HttpStatus.Conflict)
  }
}

async function assertNameAvailable(name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.subject.findUnique({ where: { name } })
  if (existing && existing.id !== excludeId) {
    throw new AppError('A subject with this name already exists.', HttpStatus.Conflict)
  }
}

export async function listSubjects(options: { q?: string; status?: SubjectStatus } = {}): Promise<SubjectView[]> {
  const where: Prisma.SubjectWhereInput = {}
  if (options.status) where.status = options.status
  if (options.q) {
    where.OR = [
      { code: { contains: options.q, mode: 'insensitive' } },
      { name: { contains: options.q, mode: 'insensitive' } },
    ]
  }
  const subjects = await prisma.subject.findMany({
    where,
    include: { _count: { select: { assignments: true } } },
    orderBy: [{ name: 'asc' }],
  })
  return subjects.map(toSubjectView)
}

export async function getSubject(id: string): Promise<SubjectView> {
  const subject = await prisma.subject.findUnique({
    where: { id },
    include: { _count: { select: { assignments: true } } },
  })
  if (!subject) {
    throw new AppError('Subject not found.', HttpStatus.NotFound)
  }
  return toSubjectView(subject)
}

export async function createSubject(
  actor: AuthenticatedUser,
  input: SubjectCreateInput,
  ip?: string,
): Promise<SubjectView> {
  const code = input.code.trim().toUpperCase()
  const name = input.name.trim()
  await assertCodeAvailable(code)
  await assertNameAvailable(name)

  const created = await prisma.subject.create({
    data: {
      code,
      name,
      description: input.description?.trim() || null,
      status: input.status ?? 'ACTIVE',
    },
  })

  await recordAudit({
    actorUserId: actor.id,
    action: 'academic.subject.create',
    resourceType: 'subject',
    resourceId: created.id,
    metadata: { code, name },
    ip: ip ?? null,
  })

  return getSubject(created.id)
}

export async function updateSubject(
  actor: AuthenticatedUser,
  id: string,
  input: SubjectUpdateInput,
  ip?: string,
): Promise<SubjectView> {
  const existing = await prisma.subject.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Subject not found.', HttpStatus.NotFound)
  }

  const data: Record<string, unknown> = {}
  const changed: string[] = []

  if (input.code !== undefined) {
    const code = input.code.trim().toUpperCase()
    await assertCodeAvailable(code, id)
    data.code = code
    changed.push('code')
  }
  if (input.name !== undefined) {
    const name = input.name.trim()
    await assertNameAvailable(name, id)
    data.name = name
    changed.push('name')
  }
  if (input.description !== undefined) {
    data.description = input.description?.trim() || null
    changed.push('description')
  }
  if (input.status !== undefined) {
    data.status = input.status
    changed.push('status')
  }

  if (Object.keys(data).length > 0) {
    await prisma.subject.update({ where: { id }, data })
  }

  if (changed.length > 0) {
    await recordAudit({
      actorUserId: actor.id,
      action: 'academic.subject.update',
      resourceType: 'subject',
      resourceId: id,
      metadata: { changed },
      ip: ip ?? null,
    })
  }

  return getSubject(id)
}

export async function setSubjectStatus(
  actor: AuthenticatedUser,
  id: string,
  status: SubjectStatus,
  ip?: string,
): Promise<SubjectView> {
  const existing = await prisma.subject.findUnique({ where: { id } })
  if (!existing) {
    throw new AppError('Subject not found.', HttpStatus.NotFound)
  }

  if (existing.status !== status) {
    await prisma.subject.update({ where: { id }, data: { status } })
    await recordAudit({
      actorUserId: actor.id,
      action: status === 'ACTIVE' ? 'academic.subject.activate' : 'academic.subject.deactivate',
      resourceType: 'subject',
      resourceId: id,
      metadata: { code: existing.code, name: existing.name },
      ip: ip ?? null,
    })
  }

  return getSubject(id)
}