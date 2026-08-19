import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'
import { OWNER_ROLE } from '../rbac/catalog'
import type { AuthenticatedUser } from '../types/auth'
import {
  createClass,
  ensureInitialClasses,
  getClass,
  listClasses,
  setClassStatus,
  updateClass,
} from './class.service'

const prismaMock = vi.hoisted(() => ({
  schoolClass: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
  auditLog: { create: vi.fn() },
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

const owner: AuthenticatedUser = {
  id: 'owner-1',
  fullName: 'Ada Lovelace',
  email: 'ada@school.edu',
  phone: null,
  status: 'ACTIVE',
  staffId: null,
  roleNames: [OWNER_ROLE],
  permissionKeys: [],
}

function classRecord(id = 'class-1', overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id,
    key: 'PRIMARY_1',
    name: 'Primary 1',
    description: 'First primary class.',
    sortOrder: 1,
    status: 'ACTIVE',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

describe('class.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.schoolClass.findMany.mockResolvedValue([classRecord()])
    prismaMock.schoolClass.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
      where.id === 'class-1' ? classRecord() : null,
    )
    prismaMock.schoolClass.create.mockResolvedValue(classRecord())
    prismaMock.schoolClass.update.mockResolvedValue({})
    prismaMock.schoolClass.upsert.mockResolvedValue(classRecord())
  })

  describe('ensureInitialClasses', () => {
    it('upserts the default class levels idempotently', async () => {
      await ensureInitialClasses()

      expect(prismaMock.schoolClass.upsert).toHaveBeenCalled()
      const calls = prismaMock.schoolClass.upsert.mock.calls as Array<
        Array<{ where: { key: string }; create: { key: string; name: string } }>
      >
      const keys = calls.map(([arg]) => arg.where.key)
      expect(keys).toContain('NURSERY')
      expect(keys).toContain('PRIMARY_1')
      expect(keys).toContain('PRIMARY_6')
    })
  })

  describe('listClasses', () => {
    it('returns classes ordered by sort order with pupil counts', async () => {
      prismaMock.schoolClass.findMany.mockResolvedValue([
        classRecord('class-2', { key: 'KG', name: 'KG', _count: { pupils: 5 } }),
      ])

      const classes = await listClasses()

      expect(classes).toHaveLength(1)
      expect(classes[0]).toMatchObject({ key: 'KG', name: 'KG', pupilCount: 5 })
    })
  })

  describe('getClass', () => {
    it('returns a class', async () => {
      const result = await getClass('class-1')
      expect(result).toMatchObject({ key: 'PRIMARY_1', name: 'Primary 1', pupilCount: 0 })
    })

    it('throws a 404 for a missing class', async () => {
      await expect(getClass('missing')).rejects.toMatchObject({ statusCode: HttpStatus.NotFound })
    })
  })

  describe('createClass', () => {
    it('creates a class and audits the action', async () => {
      prismaMock.schoolClass.create.mockResolvedValue(classRecord())

      const result = await createClass(owner, { key: 'primary_1', name: 'Primary 1' })

      expect(prismaMock.schoolClass.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          key: 'primary_1',
          name: 'Primary 1',
          status: 'ACTIVE',
          sortOrder: 0,
        }),
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'class.create' }) }),
      )
      expect(result.name).toBe('Primary 1')
    })

    it('rejects a duplicate class key', async () => {
      prismaMock.schoolClass.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
        where.key ? classRecord() : null,
      )

      await expect(createClass(owner, { key: 'PRIMARY_1', name: 'Other' })).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
      })
      expect(prismaMock.schoolClass.create).not.toHaveBeenCalled()
    })

    it('rejects a duplicate class name', async () => {
      prismaMock.schoolClass.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
        where.name ? classRecord() : null,
      )

      await expect(createClass(owner, { key: 'NEW', name: 'Primary 1' })).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
      })
    })
  })

  describe('updateClass', () => {
    it('updates class details and audits the change', async () => {
      await updateClass(owner, 'class-1', { name: 'Grade 1', sortOrder: 2 })

      expect(prismaMock.schoolClass.update).toHaveBeenCalledWith({
        where: { id: 'class-1' },
        data: expect.objectContaining({ name: 'Grade 1', sortOrder: 2 }),
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'class.update' }) }),
      )
    })

    it('rejects a name collision on update', async () => {
      prismaMock.schoolClass.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) => {
        if (where.id === 'class-1') return classRecord()
        if (where.name) return classRecord('class-2')
        return null
      })

      await expect(updateClass(owner, 'class-1', { name: 'Primary 1' })).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
      })
    })

    it('is a no-op audit when nothing changes', async () => {
      await updateClass(owner, 'class-1', {})

      expect(prismaMock.schoolClass.update).not.toHaveBeenCalled()
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
    })

    it('throws a 404 for a missing class', async () => {
      await expect(updateClass(owner, 'missing', { name: 'New' })).rejects.toMatchObject({
        statusCode: HttpStatus.NotFound,
      })
    })
  })

  describe('setClassStatus', () => {
    it('deactivates a class and audits the action', async () => {
      await setClassStatus(owner, 'class-1', 'INACTIVE')

      expect(prismaMock.schoolClass.update).toHaveBeenCalledWith({
        where: { id: 'class-1' },
        data: { status: 'INACTIVE' },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'class.deactivate' }) }),
      )
    })

    it('reactivates a class', async () => {
      prismaMock.schoolClass.findUnique.mockResolvedValue(classRecord('class-1', { status: 'INACTIVE' }))

      await setClassStatus(owner, 'class-1', 'ACTIVE')

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'class.activate' }) }),
      )
    })

    it('is a no-op when the status does not change', async () => {
      await setClassStatus(owner, 'class-1', 'ACTIVE')

      expect(prismaMock.schoolClass.update).not.toHaveBeenCalled()
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
    })
  })
})