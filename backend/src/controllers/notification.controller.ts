import { HttpStatus } from '../config/enums'
import type { AuthRequest } from '../types/auth'
import { AppError } from '../utils/app-error'
import { asyncHandler } from '../utils/async-handler'
import { ok } from '../lib/api-response'
import {
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../services/notification.service'

/**
 * GET /api/notifications — list current user's notifications with pagination.
 * Supports ?unread=true filter and returns unread count.
 */
export const listNotificationsHandler = asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id
  if (!userId) throw new AppError('Authentication required.', HttpStatus.Unauthorized)

  const limit = Math.min(Math.max(Number.parseInt(req.query.limit as string, 10) || 20, 1), 100)
  const offset = Math.max(Number.parseInt(req.query.offset as string, 10) || 0, 0)
  const unreadOnly = req.query.unread === 'true'

  const [result, unreadCount] = await Promise.all([
    listNotifications(userId, limit, offset, unreadOnly),
    countUnreadNotifications(userId),
  ])

  res.json(ok({ ...result, unreadCount }))
})

/**
 * GET /api/notifications/unread-count — returns the unread notification count.
 */
export const unreadCountHandler = asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id
  if (!userId) throw new AppError('Authentication required.', HttpStatus.Unauthorized)

  const count = await countUnreadNotifications(userId)
  res.json(ok({ count }))
})

/**
 * PATCH /api/notifications/:id/read — mark a single notification as read.
 * Enforces recipient isolation.
 */
export const markReadHandler = asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id
  if (!userId) throw new AppError('Authentication required.', HttpStatus.Unauthorized)

  const { id } = req.params
  const updated = await markNotificationRead(id, userId)
  if (!updated) {
    throw new AppError('Notification not found.', HttpStatus.NotFound)
  }

  res.json(ok(updated))
})

/**
 * PATCH /api/notifications/read-all — mark all notifications as read.
 */
export const markAllReadHandler = asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user?.id
  if (!userId) throw new AppError('Authentication required.', HttpStatus.Unauthorized)

  const count = await markAllNotificationsRead(userId)
  res.json(ok({ updated: count }))
})
