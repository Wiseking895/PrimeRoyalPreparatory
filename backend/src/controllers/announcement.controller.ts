import { z } from 'zod'
import { HttpStatus } from '../config/enums'
import type { AuthRequest } from '../types/auth'
import { AppError } from '../utils/app-error'
import { asyncHandler } from '../utils/async-handler'
import { ok, created } from '../lib/api-response'
import {
  createAnnouncement,
  updateAnnouncement,
  listAnnouncements,
  getAnnouncement,
  deleteAnnouncement,
  getAudienceUserIds,
} from '../services/announcement.service'
import { createBulkNotifications } from '../services/notification.service'
import { recordAudit } from '../services/audit.service'

const announcementCreateSchema = z.object({
  title: z.string().trim().min(2, 'Title must be at least 2 characters.').max(200),
  body: z.string().trim().min(2, 'Body must be at least 2 characters.').max(5000),
  audience: z.enum(['ALL', 'ALL_STAFF', 'TEACHING_STAFF', 'NON_TEACHING_STAFF', 'PARENTS'], {
    errorMap: () => ({ message: 'Select a valid audience.' }),
  }),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
})

const announcementUpdateSchema = z.object({
  title: z.string().trim().min(2).max(200).optional(),
  body: z.string().trim().min(2).max(5000).optional(),
  audience: z.enum(['ALL', 'ALL_STAFF', 'TEACHING_STAFF', 'NON_TEACHING_STAFF', 'PARENTS']).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED']).optional(),
})

/**
 * POST /api/announcements — create a new announcement.
 * Requires announcements.manage permission.
 */
export const createAnnouncementHandler = asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id
  if (!userId) throw new AppError('Authentication required.', HttpStatus.Unauthorized)

  const parsed = announcementCreateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError('Invalid input.', HttpStatus.BadRequest, parsed.error.flatten().fieldErrors)
  }

  const announcement = await createAnnouncement(parsed.data, userId)

  // If published, create notifications for the target audience
  if (announcement.status === 'PUBLISHED') {
    const userIds = await getAudienceUserIds(parsed.data.audience)
    if (userIds.length > 0) {
      await createBulkNotifications(
        userIds.map((uid) => ({
          recipientId: uid,
          type: 'announcement',
          title: announcement.title,
          message: announcement.body.slice(0, 200) + (announcement.body.length > 200 ? '...' : ''),
          link: '/announcements',
          resourceType: 'announcement',
          resourceId: announcement.id,
        })),
      )
    }
  }

  await recordAudit({
    actorUserId: userId,
    action: 'announcement.create',
    resourceType: 'announcement',
    resourceId: announcement.id,
    metadata: { title: announcement.title, audience: announcement.audience, status: announcement.status },
    ip: req.ip,
  })

  res.status(HttpStatus.Created).json(created(announcement))
})

/**
 * GET /api/announcements — list announcements.
 * Staff with announcements.view see PUBLISHED announcements.
 * Staff with announcements.manage see all (including DRAFT).
 */
export const listAnnouncementsHandler = asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id
  if (!userId) throw new AppError('Authentication required.', HttpStatus.Unauthorized)

  const canManage = req.user?.permissionKeys.includes('announcements.manage') ?? false
  const limit = Math.min(Math.max(Number.parseInt(req.query.limit as string, 10) || 50, 1), 100)
  const offset = Math.max(Number.parseInt(req.query.offset as string, 10) || 0, 0)

  const status = canManage ? (req.query.status as string | undefined) : 'PUBLISHED'
  const audience = req.query.audience as string | undefined

  const result = await listAnnouncements({ status, audience, limit, offset })
  res.json(ok(result))
})

/**
 * GET /api/announcements/:id — get a single announcement.
 */
export const getAnnouncementHandler = asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id
  if (!userId) throw new AppError('Authentication required.', HttpStatus.Unauthorized)

  const announcement = await getAnnouncement(req.params.id)
  if (!announcement) {
    throw new AppError('Announcement not found.', HttpStatus.NotFound)
  }

  // Non-admin users can only see PUBLISHED announcements
  const canManage = req.user?.permissionKeys.includes('announcements.manage') ?? false
  if (!canManage && announcement.status !== 'PUBLISHED') {
    throw new AppError('Announcement not found.', HttpStatus.NotFound)
  }

  res.json(ok(announcement))
})

/**
 * PATCH /api/announcements/:id — update an announcement.
 * Requires announcements.manage permission.
 */
export const updateAnnouncementHandler = asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id
  if (!userId) throw new AppError('Authentication required.', HttpStatus.Unauthorized)

  const parsed = announcementUpdateSchema.safeParse(req.body)
  if (!parsed.success) {
    throw new AppError('Invalid input.', HttpStatus.BadRequest, parsed.error.flatten().fieldErrors)
  }

  const updated = await updateAnnouncement(req.params.id, parsed.data)
  if (!updated) {
    throw new AppError('Announcement not found.', HttpStatus.NotFound)
  }

  // If status changed to PUBLISHED, create notifications
  if (parsed.data.status === 'PUBLISHED') {
    const userIds = await getAudienceUserIds(updated.audience)
    if (userIds.length > 0) {
      await createBulkNotifications(
        userIds.map((uid) => ({
          recipientId: uid,
          type: 'announcement',
          title: updated.title,
          message: updated.body.slice(0, 200) + (updated.body.length > 200 ? '...' : ''),
          link: '/announcements',
          resourceType: 'announcement',
          resourceId: updated.id,
        })),
      )
    }
  }

  await recordAudit({
    actorUserId: userId,
    action: 'announcement.update',
    resourceType: 'announcement',
    resourceId: updated.id,
    metadata: { title: updated.title, status: updated.status },
    ip: req.ip,
  })

  res.json(ok(updated))
})

/**
 * DELETE /api/announcements/:id — delete a DRAFT announcement.
 * Requires announcements.manage permission.
 */
export const deleteAnnouncementHandler = asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id
  if (!userId) throw new AppError('Authentication required.', HttpStatus.Unauthorized)

  const deleted = await deleteAnnouncement(req.params.id)
  if (!deleted) {
    throw new AppError('Announcement not found or is published.', HttpStatus.NotFound)
  }

  await recordAudit({
    actorUserId: userId,
    action: 'announcement.delete',
    resourceType: 'announcement',
    resourceId: req.params.id,
    ip: req.ip,
  })

  res.json(ok(null, 'Announcement deleted.'))
})
