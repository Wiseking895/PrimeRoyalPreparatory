import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma'

/**
 * Notification service — persistent in-app notifications for the PRPS school
 * management system. Notifications are always scoped to a specific recipient
 * (user ID). The backend determines the authenticated recipient; clients
 * never supply a recipient ID.
 *
 * Notifications are event-driven and purposeful. They are created for
 * meaningful school events (staff invitations, payment receipts, report
 * publications, attendance alerts, administrative announcements) and never
 * for routine CRUD operations.
 */

export interface NotificationView {
  id: string
  recipientId: string
  type: string
  title: string
  message: string
  read: boolean
  link: string | null
  resourceType: string | null
  resourceId: string | null
  metadata: Prisma.JsonValue | null
  createdAt: Date
}

export interface CreateNotificationInput {
  recipientId: string
  type: string
  title: string
  message: string
  link?: string | null
  resourceType?: string | null
  resourceId?: string | null
  metadata?: Prisma.InputJsonValue
}

/**
 * Creates a single notification for a recipient. Callers are responsible for
 * ensuring the recipientId is valid and the notification is appropriate.
 */
export async function createNotification(input: CreateNotificationInput): Promise<NotificationView> {
  const notification = await prisma.notification.create({
    data: {
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? undefined,
    },
  })
  return notification
}

/**
 * Creates notifications for multiple recipients in a single database operation.
 * Useful for broadcast notifications (e.g. announcements to all staff).
 */
export async function createBulkNotifications(
  inputs: CreateNotificationInput[],
): Promise<number> {
  if (inputs.length === 0) return 0
  const result = await prisma.notification.createMany({
    data: inputs.map((input) => ({
      recipientId: input.recipientId,
      type: input.type,
      title: input.title,
      message: input.message,
      link: input.link ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
      metadata: input.metadata ?? undefined,
    })),
  })
  return result.count
}

/**
 * Lists notifications for a specific recipient with pagination.
 * Enforces recipient isolation — only the recipient's own notifications are returned.
 */
export async function listNotifications(
  recipientId: string,
  limit: number,
  offset: number,
  unreadOnly: boolean = false,
): Promise<{ items: NotificationView[]; total: number }> {
  const where: Prisma.NotificationWhereInput = {
    recipientId,
    ...(unreadOnly ? { read: false } : {}),
  }

  const [items, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
  ])

  return { items, total }
}

/**
 * Returns the unread notification count for a recipient.
 */
export async function countUnreadNotifications(recipientId: string): Promise<number> {
  return prisma.notification.count({
    where: { recipientId, read: false },
  })
}

/**
 * Marks a single notification as read. Enforces recipient isolation.
 * Returns the updated notification or null if not found / not owned by recipient.
 */
export async function markNotificationRead(
  notificationId: string,
  recipientId: string,
): Promise<NotificationView | null> {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  })

  if (!notification || notification.recipientId !== recipientId) {
    return null
  }

  if (notification.read) {
    return notification
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true },
  })

  return updated
}

/**
 * Marks all unread notifications for a recipient as read.
 * Returns the count of notifications updated.
 */
export async function markAllNotificationsRead(recipientId: string): Promise<number> {
  const result = await prisma.notification.updateMany({
    where: { recipientId, read: false },
    data: { read: true },
  })
  return result.count
}

/**
 * Deletes old read notifications for a recipient beyond the retention limit.
 * Keeps the most recent `keepCount` read notifications; older ones are deleted.
 * Unread notifications are never auto-deleted.
 */
export async function pruneOldNotifications(
  recipientId: string,
  keepCount: number = 100,
): Promise<number> {
  const oldRead = await prisma.notification.findMany({
    where: { recipientId, read: true },
    orderBy: { createdAt: 'desc' },
    skip: keepCount,
    select: { id: true },
  })

  if (oldRead.length === 0) return 0

  const result = await prisma.notification.deleteMany({
    where: { id: { in: oldRead.map((n) => n.id) } },
  })
  return result.count
}
