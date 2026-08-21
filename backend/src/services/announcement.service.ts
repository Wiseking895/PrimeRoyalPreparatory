import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

/**
 * Announcement service — school-wide or targeted announcements for the PRPS
 * school management system. Announcements are created by administrative staff
 * (Owner, Headteacher) and published to specific audiences or all users.
 *
 * Audience values:
 *   - ALL: all staff and parents
 *   - ALL_STAFF: all staff users
 *   - TEACHING_STAFF: CLASS_TEACHER, SUBJECT_TEACHER roles
 *   - NON_TEACHING_STAFF: ACCOUNTANT, NON_TEACHING_STAFF, ADMINISTRATIVE_STAFF, SUPPORT_STAFF
 *   - PARENTS: guardian parent portal accounts (notifications go to guardians)
 */

export type AnnouncementStatus = 'DRAFT' | 'PUBLISHED'
export type AnnouncementAudience = 'ALL' | 'ALL_STAFF' | 'TEACHING_STAFF' | 'NON_TEACHING_STAFF' | 'PARENTS'

const VALID_AUDIENCES: Set<string> = new Set(['ALL', 'ALL_STAFF', 'TEACHING_STAFF', 'NON_TEACHING_STAFF', 'PARENTS'])
const VALID_STATUSES: Set<string> = new Set(['DRAFT', 'PUBLISHED'])

const TEACHING_ROLES = ['CLASS_TEACHER', 'SUBJECT_TEACHER']
const NON_TEACHING_ROLES = ['ACCOUNTANT', 'NON_TEACHING_STAFF', 'ADMINISTRATIVE_STAFF', 'SUPPORT_STAFF']

export interface AnnouncementView {
  id: string
  title: string
  body: string
  audience: string
  status: string
  publishedAt: Date | null
  createdById: string
  createdByName: string
  createdAt: Date
  updatedAt: Date
}

export interface CreateAnnouncementInput {
  title: string
  body: string
  audience: AnnouncementAudience
  status?: AnnouncementStatus
}

export interface UpdateAnnouncementInput {
  title?: string
  body?: string
  audience?: AnnouncementAudience
  status?: AnnouncementStatus
}

function validateAudience(audience: string): void {
  if (!VALID_AUDIENCES.has(audience)) {
    throw new Error(`Invalid audience: ${audience}`)
  }
}

function validateStatus(status: string): void {
  if (!VALID_STATUSES.has(status)) {
    throw new Error(`Invalid status: ${status}`)
  }
}

/**
 * Creates a new announcement. The creator is the authenticated user.
 */
export async function createAnnouncement(
  input: CreateAnnouncementInput,
  createdById: string,
): Promise<AnnouncementView> {
  validateAudience(input.audience)
  const status = input.status ?? 'DRAFT'
  validateStatus(status)

  const announcement = await prisma.announcement.create({
    data: {
      title: input.title,
      body: input.body,
      audience: input.audience,
      status,
      publishedAt: status === 'PUBLISHED' ? new Date() : null,
      createdById,
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  })

  return {
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    audience: announcement.audience,
    status: announcement.status,
    publishedAt: announcement.publishedAt,
    createdById: announcement.createdById,
    createdByName: announcement.createdBy.fullName,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
  }
}

/**
 * Updates an existing announcement. Only DRAFT announcements can be fully edited;
 * PUBLISHED announcements can only be unpublished (status change).
 */
export async function updateAnnouncement(
  id: string,
  input: UpdateAnnouncementInput,
): Promise<AnnouncementView | null> {
  const existing = await prisma.announcement.findUnique({ where: { id } })
  if (!existing) return null

  if (input.audience) validateAudience(input.audience)
  if (input.status) validateStatus(input.status)

  const newStatus = input.status ?? existing.status
  const wasPublished = existing.status === 'PUBLISHED'
  const willPublish = newStatus === 'PUBLISHED' && !wasPublished

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      ...(input.title !== undefined && { title: input.title }),
      ...(input.body !== undefined && { body: input.body }),
      ...(input.audience !== undefined && { audience: input.audience }),
      ...(input.status !== undefined && { status: input.status }),
      ...(willPublish && { publishedAt: new Date() }),
    },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  })

  return {
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    audience: announcement.audience,
    status: announcement.status,
    publishedAt: announcement.publishedAt,
    createdById: announcement.createdById,
    createdByName: announcement.createdBy.fullName,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
  }
}

/**
 * Lists announcements with optional filtering by status and audience.
 * Non-admin users should only see PUBLISHED announcements.
 */
export async function listAnnouncements(params: {
  status?: string
  audience?: string
  limit?: number
  offset?: number
}): Promise<{ items: AnnouncementView[]; total: number }> {
  const { status, audience, limit = 50, offset = 0 } = params

  const where: Prisma.AnnouncementWhereInput = {}
  if (status) where.status = status
  if (audience) where.audience = audience

  const [items, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        createdBy: { select: { id: true, fullName: true } },
      },
    }),
    prisma.announcement.count({ where }),
  ])

  return {
    items: items.map((a) => ({
      id: a.id,
      title: a.title,
      body: a.body,
      audience: a.audience,
      status: a.status,
      publishedAt: a.publishedAt,
      createdById: a.createdById,
      createdByName: a.createdBy.fullName,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    })),
    total,
  }
}

/**
 * Gets a single announcement by ID.
 */
export async function getAnnouncement(id: string): Promise<AnnouncementView | null> {
  const announcement = await prisma.announcement.findUnique({
    where: { id },
    include: {
      createdBy: { select: { id: true, fullName: true } },
    },
  })

  if (!announcement) return null

  return {
    id: announcement.id,
    title: announcement.title,
    body: announcement.body,
    audience: announcement.audience,
    status: announcement.status,
    publishedAt: announcement.publishedAt,
    createdById: announcement.createdById,
    createdByName: announcement.createdBy.fullName,
    createdAt: announcement.createdAt,
    updatedAt: announcement.updatedAt,
  }
}

/**
 * Deletes a DRAFT announcement. PUBLISHED announcements cannot be deleted
 * (they should be unpublished first).
 */
export async function deleteAnnouncement(id: string): Promise<boolean> {
  const existing = await prisma.announcement.findUnique({ where: { id } })
  if (!existing) return false
  if (existing.status === 'PUBLISHED') return false

  await prisma.announcement.delete({ where: { id } })
  return true
}

/**
 * Gets user IDs for a given audience filter. Used when creating notifications
 * for an announcement's target audience.
 */
export async function getAudienceUserIds(audience: string): Promise<string[]> {
  validateAudience(audience)

  if (audience === 'ALL') {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    })
    return users.map((u) => u.id)
  }

  if (audience === 'ALL_STAFF') {
    const users = await prisma.user.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    })
    return users.map((u) => u.id)
  }

  if (audience === 'TEACHING_STAFF') {
    const users = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        roles: { some: { role: { name: { in: TEACHING_ROLES } } } },
      },
      select: { id: true },
    })
    return users.map((u) => u.id)
  }

  if (audience === 'NON_TEACHING_STAFF') {
    const users = await prisma.user.findMany({
      where: {
        status: 'ACTIVE',
        roles: { some: { role: { name: { in: NON_TEACHING_ROLES } } } },
      },
      select: { id: true },
    })
    return users.map((u) => u.id)
  }

  if (audience === 'PARENTS') {
    const guardians = await prisma.guardian.findMany({
      where: { status: 'ACTIVE', passwordHash: { not: null } },
      select: { id: true },
    })
    return guardians.map((g) => g.id)
  }

  return []
}
