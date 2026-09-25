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
    division: null,
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

  describe('class divisions (optional)', () => {
    /** In-memory class store so create/get/uniqueness behave like the real DB. */
    function mockClassStore(initial: Array<Record<string, unknown>> = []) {
      const store = new Map<string, Record<string, unknown>>(
        initial.map((record) => [String(record.id), record]),
      )
      let sequence = store.size
      prismaMock.schoolClass.create.mockImplementation(
        async ({ data }: { data: Record<string, unknown> }) => {
          sequence += 1
          const record = classRecord(`class-${sequence}`, data)
          store.set(record.id, record)
          return record
        },
      )
      prismaMock.schoolClass.findUnique.mockImplementation(
        async ({ where }: { where: Record<string, string> }) => {
          const values = [...store.values()]
          if (where.id) return store.get(where.id) ?? null
          if (where.name) return values.find((record) => record.name === where.name) ?? null
          if (where.key) return values.find((record) => record.key === where.key) ?? null
          return null
        },
      )
      prismaMock.schoolClass.findMany.mockResolvedValue([...store.values()])
      return store
    }

    it('creates Creche without a division', async () => {
      mockClassStore()

      const result = await createClass(owner, { key: 'CRECHE', name: 'Creche' })

      expect(prismaMock.schoolClass.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ key: 'CRECHE', name: 'Creche', division: null }),
      })
      expect(result).toMatchObject({ name: 'Creche', classLevel: 'Creche', division: null })
    })

    it('creates Nursery 1 undivided and does not append "Undivided"', async () => {
      mockClassStore()

      const result = await createClass(owner, { key: 'NURSERY_1', name: 'Nursery 1' })

      expect(result.name).toBe('Nursery 1')
      expect(result.name).not.toContain('Undivided')
      expect(result).toMatchObject({ classLevel: 'Nursery 1', division: null })
    })

    it('creates Nursery 1A with division A', async () => {
      mockClassStore()

      const result = await createClass(owner, { key: 'NURSERY_1_A', name: 'Nursery 1', division: 'A' })

      expect(prismaMock.schoolClass.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ name: 'Nursery 1A', division: 'A' }),
      })
      expect(result).toMatchObject({ name: 'Nursery 1A', classLevel: 'Nursery 1', division: 'A' })
    })

    it('creates Nursery 1B with division B', async () => {
      mockClassStore()

      const result = await createClass(owner, { key: 'NURSERY_1_B', name: 'Nursery 1', division: 'B' })

      expect(result).toMatchObject({ name: 'Nursery 1B', classLevel: 'Nursery 1', division: 'B' })
    })

    it('creates Basic 6D with division D', async () => {
      mockClassStore()

      const result = await createClass(owner, { key: 'BASIC_6_D', name: 'Basic 6', division: 'D' })

      expect(result).toMatchObject({ name: 'Basic 6D', classLevel: 'Basic 6', division: 'D' })
    })

    it('rejects a duplicate Nursery 1A', async () => {
      mockClassStore([
        classRecord('class-n1a', { key: 'NURSERY_1_A', name: 'Nursery 1A', division: 'A' }),
      ])

      await expect(
        createClass(owner, { key: 'NURSERY_1_A2', name: 'Nursery 1', division: 'A' }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.Conflict })
      expect(prismaMock.schoolClass.create).not.toHaveBeenCalled()
    })

    it('allows Nursery 1 and Nursery 1A to coexist', async () => {
      const store = mockClassStore()

      const undivided = await createClass(owner, { key: 'NURSERY_1', name: 'Nursery 1' })
      const divided = await createClass(owner, { key: 'NURSERY_1_A', name: 'Nursery 1', division: 'A' })

      expect(undivided.name).toBe('Nursery 1')
      expect(divided.name).toBe('Nursery 1A')
      expect(store.size).toBe(2)
      expect(prismaMock.schoolClass.create).toHaveBeenCalledTimes(2)
    })

    it('allows Basic 3 and Basic 3A to coexist', async () => {
      const store = mockClassStore()

      await createClass(owner, { key: 'BASIC_3', name: 'Basic 3' })
      await createClass(owner, { key: 'BASIC_3_A', name: 'Basic 3', division: 'A' })

      expect(store.size).toBe(2)
    })

    it('loads existing undivided classes exactly as before', async () => {
      mockClassStore([
        classRecord('class-legacy', { key: 'PRIMARY_1', name: 'Primary 1', division: null }),
      ])

      const result = await getClass('class-legacy')

      expect(result).toMatchObject({
        name: 'Primary 1',
        classLevel: 'Primary 1',
        division: null,
        pupilCount: 0,
      })
    })

    it('treats a legacy row whose name ends with a division letter as undivided', async () => {
      mockClassStore([
        classRecord('class-legacy', { key: 'OLD_N1A', name: 'Nursery 1A', division: null }),
      ])

      const result = await getClass('class-legacy')

      expect(result).toMatchObject({ name: 'Nursery 1A', classLevel: 'Nursery 1A', division: null })
    })

    it('keeps existing pupil relationships intact when loading a class', async () => {
      mockClassStore([
        classRecord('class-with-pupils', {
          key: 'BASIC_3_B',
          name: 'Basic 3B',
          division: 'B',
          pupils: [{ status: 'ACTIVE' }, { status: 'INACTIVE' }],
        }),
      ])

      const result = await getClass('class-with-pupils')

      expect(result).toMatchObject({ name: 'Basic 3B', pupilCount: 2, activePupilCount: 1 })
    })

    it('edits a class division without creating a duplicate record', async () => {
      mockClassStore([classRecord('class-1', { key: 'BASIC_3', name: 'Basic 3', division: null })])

      const result = await updateClass(owner, 'class-1', { name: 'Basic 3', division: 'A' })

      expect(prismaMock.schoolClass.update).toHaveBeenCalledWith({
        where: { id: 'class-1' },
        data: { name: 'Basic 3A', division: 'A' },
      })
      expect(prismaMock.schoolClass.create).not.toHaveBeenCalled()
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'class.update',
            metadata: expect.objectContaining({ changed: ['name', 'division'] }),
          }),
        }),
      )
      expect(result).toMatchObject({ id: 'class-1' })
    })

    it('changes a division from A to B on the same class record', async () => {
      mockClassStore([classRecord('class-1', { key: 'BASIC_3_A', name: 'Basic 3A', division: 'A' })])

      await updateClass(owner, 'class-1', { name: 'Basic 3', division: 'B' })

      expect(prismaMock.schoolClass.update).toHaveBeenCalledWith({
        where: { id: 'class-1' },
        data: { name: 'Basic 3B', division: 'B' },
      })
      expect(prismaMock.schoolClass.create).not.toHaveBeenCalled()
    })

    it('removes a division back to undivided', async () => {
      mockClassStore([classRecord('class-1', { key: 'BASIC_3_A', name: 'Basic 3A', division: 'A' })])

      await updateClass(owner, 'class-1', { name: 'Basic 3', division: null })

      expect(prismaMock.schoolClass.update).toHaveBeenCalledWith({
        where: { id: 'class-1' },
        data: { name: 'Basic 3', division: null },
      })
    })

    it('rejects an edit that would duplicate another class', async () => {
      mockClassStore([
        classRecord('class-1', { key: 'BASIC_3', name: 'Basic 3', division: null }),
        classRecord('class-2', { key: 'BASIC_3_B', name: 'Basic 3B', division: 'B' }),
      ])

      await expect(
        updateClass(owner, 'class-1', { name: 'Basic 3', division: 'B' }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.Conflict })
      expect(prismaMock.schoolClass.update).not.toHaveBeenCalled()
    })

    it('is a no-op when name and division are unchanged', async () => {
      mockClassStore([classRecord('class-1', { key: 'BASIC_3_A', name: 'Basic 3A', division: 'A' })])

      await updateClass(owner, 'class-1', { name: 'Basic 3', division: 'A' })

      expect(prismaMock.schoolClass.update).not.toHaveBeenCalled()
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
    })

    it('rejects an invalid division value', async () => {
      mockClassStore()

      await expect(
        createClass(owner, { key: 'NURSERY_1_E', name: 'Nursery 1', division: 'E' }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.BadRequest })
      expect(prismaMock.schoolClass.create).not.toHaveBeenCalled()
    })

    it('keeps divisions as distinct classes in list responses', async () => {
      mockClassStore([
        classRecord('c1', { key: 'NURSERY_1', name: 'Nursery 1', division: null, sortOrder: 1 }),
        classRecord('c2', { key: 'NURSERY_1_A', name: 'Nursery 1A', division: 'A', sortOrder: 2 }),
        classRecord('c3', { key: 'NURSERY_1_B', name: 'Nursery 1B', division: 'B', sortOrder: 3 }),
      ])

      const classes = await listClasses()

      expect(classes.map((klass) => klass.name)).toEqual(['Nursery 1', 'Nursery 1A', 'Nursery 1B'])
      expect(classes.map((klass) => klass.id)).toEqual(['c1', 'c2', 'c3'])
    })
  })
})