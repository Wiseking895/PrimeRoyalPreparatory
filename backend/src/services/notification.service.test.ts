import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  notification: {
    create: vi.fn(),
    createMany: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
    count: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

import {
  createNotification,
  createBulkNotifications,
  listNotifications,
  countUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  pruneOldNotifications,
} from './notification.service'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notification.service', () => {
  const sampleNotification = {
    id: 'n1',
    recipientId: 'u1',
    type: 'staff_invitation',
    title: 'Welcome',
    message: 'Your account is ready.',
    read: false,
    link: null,
    resourceType: null,
    resourceId: null,
    metadata: null,
    createdAt: new Date(),
  }

  describe('createNotification', () => {
    it('creates a notification for a recipient', async () => {
      prismaMock.notification.create.mockResolvedValue(sampleNotification)

      const result = await createNotification({
        recipientId: 'u1',
        type: 'staff_invitation',
        title: 'Welcome',
        message: 'Your account is ready.',
      })

      expect(result.id).toBe('n1')
      expect(result.recipientId).toBe('u1')
      expect(prismaMock.notification.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          recipientId: 'u1',
          type: 'staff_invitation',
          title: 'Welcome',
          message: 'Your account is ready.',
        }),
      })
    })
  })

  describe('createBulkNotifications', () => {
    it('creates multiple notifications', async () => {
      prismaMock.notification.createMany.mockResolvedValue({ count: 3 })

      const count = await createBulkNotifications([
        { recipientId: 'u1', type: 'announcement', title: 'A1', message: 'M1' },
        { recipientId: 'u2', type: 'announcement', title: 'A1', message: 'M1' },
        { recipientId: 'u3', type: 'announcement', title: 'A1', message: 'M1' },
      ])

      expect(count).toBe(3)
      expect(prismaMock.notification.createMany).toHaveBeenCalledOnce()
    })

    it('returns 0 for empty input', async () => {
      const count = await createBulkNotifications([])
      expect(count).toBe(0)
      expect(prismaMock.notification.createMany).not.toHaveBeenCalled()
    })
  })

  describe('listNotifications', () => {
    it('returns notifications for a recipient', async () => {
      prismaMock.notification.findMany.mockResolvedValue([sampleNotification])
      prismaMock.notification.count.mockResolvedValue(1)

      const result = await listNotifications('u1', 20, 0)

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })

    it('filters unread only when requested', async () => {
      prismaMock.notification.findMany.mockResolvedValue([])
      prismaMock.notification.count.mockResolvedValue(0)

      await listNotifications('u1', 20, 0, true)

      expect(prismaMock.notification.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { recipientId: 'u1', read: false },
        }),
      )
    })
  })

  describe('countUnreadNotifications', () => {
    it('returns the unread count', async () => {
      prismaMock.notification.count.mockResolvedValue(5)

      const count = await countUnreadNotifications('u1')

      expect(count).toBe(5)
    })
  })

  describe('markNotificationRead', () => {
    it('marks a notification as read when owned by recipient', async () => {
      prismaMock.notification.findUnique.mockResolvedValue(sampleNotification)
      prismaMock.notification.update.mockResolvedValue({ ...sampleNotification, read: true })

      const result = await markNotificationRead('n1', 'u1')

      expect(result?.read).toBe(true)
    })

    it('returns null when notification not found', async () => {
      prismaMock.notification.findUnique.mockResolvedValue(null)

      const result = await markNotificationRead('n1', 'u1')

      expect(result).toBeNull()
    })

    it('returns null when recipient does not match', async () => {
      prismaMock.notification.findUnique.mockResolvedValue({ ...sampleNotification, recipientId: 'u2' })

      const result = await markNotificationRead('n1', 'u1')

      expect(result).toBeNull()
    })
  })

  describe('markAllNotificationsRead', () => {
    it('marks all unread as read', async () => {
      prismaMock.notification.updateMany.mockResolvedValue({ count: 3 })

      const count = await markAllNotificationsRead('u1')

      expect(count).toBe(3)
    })
  })

  describe('pruneOldNotifications', () => {
    it('deletes old read notifications', async () => {
      prismaMock.notification.findMany.mockResolvedValue([{ id: 'old1' }, { id: 'old2' }])
      prismaMock.notification.deleteMany.mockResolvedValue({ count: 2 })

      const count = await pruneOldNotifications('u1', 100)

      expect(count).toBe(2)
    })

    it('returns 0 when no pruning needed', async () => {
      prismaMock.notification.findMany.mockResolvedValue([])

      const count = await pruneOldNotifications('u1', 100)

      expect(count).toBe(0)
    })
  })
})
