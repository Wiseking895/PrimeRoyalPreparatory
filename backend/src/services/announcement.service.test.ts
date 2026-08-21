import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  announcement: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    delete: vi.fn(),
  },
  user: { findMany: vi.fn() },
  guardian: { findMany: vi.fn() },
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

import {
  createAnnouncement,
  updateAnnouncement,
  listAnnouncements,
  getAnnouncement,
  deleteAnnouncement,
  getAudienceUserIds,
} from './announcement.service'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('announcement.service', () => {
  const sampleAnnouncement = {
    id: 'a1',
    title: 'School Meeting',
    body: 'Please attend the meeting.',
    audience: 'ALL_STAFF',
    status: 'DRAFT',
    publishedAt: null,
    createdById: 'u1',
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: { id: 'u1', fullName: 'Admin' },
  }

  describe('createAnnouncement', () => {
    it('creates a draft announcement', async () => {
      prismaMock.announcement.create.mockResolvedValue(sampleAnnouncement)

      const result = await createAnnouncement(
        { title: 'School Meeting', body: 'Please attend the meeting.', audience: 'ALL_STAFF' },
        'u1',
      )

      expect(result.id).toBe('a1')
      expect(result.status).toBe('DRAFT')
    })

    it('creates a published announcement with publishedAt', async () => {
      prismaMock.announcement.create.mockResolvedValue({
        ...sampleAnnouncement,
        status: 'PUBLISHED',
        publishedAt: new Date(),
      })

      const result = await createAnnouncement(
        { title: 'Published', body: 'Body', audience: 'ALL_STAFF', status: 'PUBLISHED' },
        'u1',
      )

      expect(result.status).toBe('PUBLISHED')
      expect(result.publishedAt).toBeTruthy()
    })
  })

  describe('updateAnnouncement', () => {
    it('updates an existing announcement', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue(sampleAnnouncement)
      prismaMock.announcement.update.mockResolvedValue({
        ...sampleAnnouncement,
        title: 'Updated Title',
      })

      const result = await updateAnnouncement('a1', { title: 'Updated Title' })

      expect(result?.title).toBe('Updated Title')
    })

    it('returns null for non-existent', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue(null)

      const result = await updateAnnouncement('a1', { title: 'Updated' })

      expect(result).toBeNull()
    })
  })

  describe('listAnnouncements', () => {
    it('returns announcements with pagination', async () => {
      prismaMock.announcement.findMany.mockResolvedValue([sampleAnnouncement])
      prismaMock.announcement.count.mockResolvedValue(1)

      const result = await listAnnouncements({ limit: 10, offset: 0 })

      expect(result.items).toHaveLength(1)
      expect(result.total).toBe(1)
    })
  })

  describe('getAnnouncement', () => {
    it('returns an announcement by ID', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue(sampleAnnouncement)

      const result = await getAnnouncement('a1')

      expect(result?.id).toBe('a1')
    })

    it('returns null for non-existent', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue(null)

      const result = await getAnnouncement('nonexistent')

      expect(result).toBeNull()
    })
  })

  describe('deleteAnnouncement', () => {
    it('deletes a DRAFT announcement', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue(sampleAnnouncement)
      prismaMock.announcement.delete.mockResolvedValue({})

      const result = await deleteAnnouncement('a1')

      expect(result).toBe(true)
    })

    it('refuses to delete PUBLISHED', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue({
        ...sampleAnnouncement,
        status: 'PUBLISHED',
      })

      const result = await deleteAnnouncement('a1')

      expect(result).toBe(false)
    })

    it('returns false for non-existent', async () => {
      prismaMock.announcement.findUnique.mockResolvedValue(null)

      const result = await deleteAnnouncement('nonexistent')

      expect(result).toBe(false)
    })
  })

  describe('getAudienceUserIds', () => {
    it('returns all active user IDs for ALL', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 'u1' }, { id: 'u2' }])

      const ids = await getAudienceUserIds('ALL')

      expect(ids).toEqual(['u1', 'u2'])
    })

    it('returns teaching staff for TEACHING_STAFF', async () => {
      prismaMock.user.findMany.mockResolvedValue([{ id: 't1' }])

      const ids = await getAudienceUserIds('TEACHING_STAFF')

      expect(ids).toEqual(['t1'])
    })

    it('returns parents for PARENTS', async () => {
      prismaMock.guardian.findMany.mockResolvedValue([{ id: 'g1' }])

      const ids = await getAudienceUserIds('PARENTS')

      expect(ids).toEqual(['g1'])
    })

    it('throws for invalid audience', async () => {
      await expect(getAudienceUserIds('INVALID')).rejects.toThrow('Invalid audience')
    })
  })
})
