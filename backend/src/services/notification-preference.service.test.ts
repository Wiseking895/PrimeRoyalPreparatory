import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  notificationPreference: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

import {
  getNotificationPreferences,
  updateNotificationPreferences,
  isInAppEnabled,
  isEmailEnabled,
} from './notification-preference.service'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('notification-preference.service', () => {
  const samplePref = {
    id: 'p1',
    userId: 'u1',
    emailEnabled: true,
    inAppEnabled: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  describe('getNotificationPreferences', () => {
    it('returns existing preferences', async () => {
      prismaMock.notificationPreference.findUnique.mockResolvedValue(samplePref)

      const result = await getNotificationPreferences('u1')

      expect(result.userId).toBe('u1')
      expect(result.emailEnabled).toBe(true)
    })

    it('creates defaults if none exist', async () => {
      prismaMock.notificationPreference.findUnique.mockResolvedValue(null)
      prismaMock.notificationPreference.create.mockResolvedValue(samplePref)

      const result = await getNotificationPreferences('u1')

      expect(result.userId).toBe('u1')
      expect(prismaMock.notificationPreference.create).toHaveBeenCalledWith({
        data: { userId: 'u1' },
      })
    })
  })

  describe('updateNotificationPreferences', () => {
    it('updates email preference', async () => {
      prismaMock.notificationPreference.findUnique.mockResolvedValue(samplePref)
      prismaMock.notificationPreference.update.mockResolvedValue({
        ...samplePref,
        emailEnabled: false,
      })

      const result = await updateNotificationPreferences('u1', { emailEnabled: false })

      expect(result.emailEnabled).toBe(false)
    })

    it('creates if none exist', async () => {
      prismaMock.notificationPreference.findUnique.mockResolvedValue(null)
      prismaMock.notificationPreference.create.mockResolvedValue({
        ...samplePref,
        inAppEnabled: false,
      })

      const result = await updateNotificationPreferences('u1', { inAppEnabled: false })

      expect(result.inAppEnabled).toBe(false)
    })
  })

  describe('isInAppEnabled', () => {
    it('returns true by default', async () => {
      prismaMock.notificationPreference.findUnique.mockResolvedValue(null)

      expect(await isInAppEnabled('u1')).toBe(true)
    })

    it('returns false when disabled', async () => {
      prismaMock.notificationPreference.findUnique.mockResolvedValue({
        ...samplePref,
        inAppEnabled: false,
      })

      expect(await isInAppEnabled('u1')).toBe(false)
    })
  })

  describe('isEmailEnabled', () => {
    it('returns true by default', async () => {
      prismaMock.notificationPreference.findUnique.mockResolvedValue(null)

      expect(await isEmailEnabled('u1')).toBe(true)
    })

    it('returns false when disabled', async () => {
      prismaMock.notificationPreference.findUnique.mockResolvedValue({
        ...samplePref,
        emailEnabled: false,
      })

      expect(await isEmailEnabled('u1')).toBe(false)
    })
  })
})
