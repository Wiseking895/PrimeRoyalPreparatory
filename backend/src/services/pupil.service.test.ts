import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'
import { HEADTEACHER_ROLE, OWNER_ROLE } from '../rbac/catalog'
import type { AuthenticatedUser } from '../types/auth'
import {
  createPupil,
  getPupil,
  getPupilStats,
  listPupils,
  setPupilStatus,
  updatePupil,
} from './pupil.service'

const prismaMock = vi.hoisted(() => ({
  pupil: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  schoolClass: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
  },
  guardian: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  pupilGuardian: {
    create: vi.fn(),
    deleteMany: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
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

const headteacher: AuthenticatedUser = {
  id: 'ht-1',
  fullName: 'Grace Hopper',
  email: 'grace@school.edu',
  phone: null,
  status: 'ACTIVE',
  staffId: 'PRPS-HT-001',
  roleNames: [HEADTEACHER_ROLE],
  permissionKeys: ['pupils.view', 'pupils.create', 'pupils.update'],
}

function pupilRecord(id = 'p-1', overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id,
    pupilId: 'PRPS-PUP-0001',
    admissionNumber: 'ADM-2026-001',
    firstName: 'Ama',
    middleName: null,
    lastName: 'Owusu',
    dateOfBirth: new Date('2019-05-12T00:00:00.000Z'),
    gender: 'FEMALE',
    profilePictureUrl: null,
    classId: 'class-1',
    dateAdmitted: now,
    status: 'ACTIVE',
    address: 'Accra',
    createdAt: now,
    updatedAt: now,
    class: { id: 'class-1', name: 'Primary 1' },
    guardians: [
      {
        relationship: 'Mother',
        isPrimary: true,
        isEmergency: false,
        guardian: {
          id: 'g-1',
          fullName: 'Efua Owusu',
          phone: '+233 20 000 0000',
          email: 'efua@example.com',
          address: null,
        },
      },
    ],
    ...overrides,
  }
}

function setupPupilLookup() {
  prismaMock.pupil.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) => {
    if (where.id === 'p-1') return pupilRecord()
    return null
  })
}

const createInput = {
  firstName: ' Ama ',
  lastName: ' Owusu ',
  dateOfBirth: '2019-05-12',
  gender: 'FEMALE' as const,
  classId: 'class-1',
}

describe('pupil.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.pupil.update.mockResolvedValue({})
    prismaMock.pupil.count.mockResolvedValue(0)
    prismaMock.pupil.findMany.mockResolvedValue([pupilRecord()])
    prismaMock.schoolClass.findUnique.mockResolvedValue({ id: 'class-1', name: 'Primary 1' })
    prismaMock.guardian.findFirst.mockResolvedValue(null)
    prismaMock.guardian.create.mockResolvedValue({ id: 'g-1' })
    prismaMock.pupilGuardian.create.mockResolvedValue({})
    prismaMock.pupilGuardian.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.$transaction.mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') return arg(prismaMock)
      return Promise.resolve(arg)
    })
    setupPupilLookup()
  })

  describe('listPupils', () => {
    it('returns a paginated pupil list', async () => {
      prismaMock.pupil.count.mockResolvedValue(1)

      const result = await listPupils()

      expect(result.items).toHaveLength(1)
      expect(result.items[0]).toMatchObject({
        pupilId: 'PRPS-PUP-0001',
        fullName: 'Ama Owusu',
        className: 'Primary 1',
        status: 'ACTIVE',
      })
      expect(result.total).toBe(1)
      expect(result.hasMore).toBe(false)
    })

    it('searches pupil ID, admission number and names', async () => {
      await listPupils({ q: 'ama' })

      expect(prismaMock.pupil.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { pupilId: { contains: 'ama', mode: 'insensitive' } },
              { admissionNumber: { contains: 'ama', mode: 'insensitive' } },
              { firstName: { contains: 'ama', mode: 'insensitive' } },
              { lastName: { contains: 'ama', mode: 'insensitive' } },
            ]),
          }),
        }),
      )
    })

    it('applies status and class filters', async () => {
      await listPupils({ status: 'INACTIVE', classId: 'class-2' })

      expect(prismaMock.pupil.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'INACTIVE', classId: 'class-2' },
        }),
      )
    })

    it('sorts by name and admits a page offset', async () => {
      await listPupils({ sortBy: 'name', order: 'asc', page: 2, pageSize: 10 })

      expect(prismaMock.pupil.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
          skip: 10,
          take: 10,
        }),
      )
    })

    it('never exposes internal or sensitive fields', async () => {
      const result = await listPupils()
      expect(JSON.stringify(result)).not.toContain('passwordHash')
      expect(JSON.stringify(result)).not.toContain('password')
    })
  })

  describe('getPupil', () => {
    it('returns the pupil with guardians', async () => {
      const result = await getPupil('p-1')

      expect(result.id).toBe('p-1')
      expect(result.guardians).toHaveLength(1)
      expect(result.guardians[0]).toMatchObject({
        fullName: 'Efua Owusu',
        relationship: 'Mother',
        isPrimary: true,
      })
    })

    it('throws a 404 for a missing pupil', async () => {
      await expect(getPupil('missing')).rejects.toMatchObject({ statusCode: HttpStatus.NotFound })
    })
  })

  describe('createPupil', () => {
    it('creates a pupil with a generated pupil ID and audits the action', async () => {
      prismaMock.pupil.create.mockResolvedValue({ id: 'p-1' })

      const result = await createPupil(owner, createInput)

      expect(prismaMock.pupil.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pupilId: 'PRPS-PUP-0001',
          admissionNumber: null,
          firstName: 'Ama',
          lastName: 'Owusu',
          classId: 'class-1',
          status: 'ACTIVE',
        }),
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'pupil.create' }) }),
      )
      expect(result.pupilId).toBe('PRPS-PUP-0001')
    })

    it('keeps an explicit pupil ID and admission number', async () => {
      prismaMock.pupil.create.mockResolvedValue({ id: 'p-1' })

      await createPupil(owner, { ...createInput, pupilId: 'P-2026-014', admissionNumber: 'ADM-014' })

      expect(prismaMock.pupil.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ pupilId: 'P-2026-014', admissionNumber: 'ADM-014' }),
      })
      expect(prismaMock.pupil.count).not.toHaveBeenCalled()
    })

    it('creates guardian links with relationship flags', async () => {
      prismaMock.pupil.create.mockResolvedValue({ id: 'p-1' })

      await createPupil(owner, {
        ...createInput,
        guardians: [
          { fullName: 'Efua Owusu', relationship: 'Mother', phone: '+233 20 000 0000', isPrimary: true },
          { fullName: 'Kwame Owusu', relationship: 'Father', phone: '+233 20 000 0001', isEmergency: true },
        ],
      })

      expect(prismaMock.guardian.create).toHaveBeenCalledTimes(2)
      expect(prismaMock.pupilGuardian.create).toHaveBeenCalledTimes(2)
      expect(prismaMock.pupilGuardian.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ pupilId: 'p-1', isPrimary: true, isEmergency: false }),
        }),
      )
    })

    it('reuses an existing guardian matched by email', async () => {
      prismaMock.pupil.create.mockResolvedValue({ id: 'p-1' })
      prismaMock.guardian.findFirst.mockResolvedValue({ id: 'g-9' })

      await createPupil(owner, {
        ...createInput,
        guardians: [{ fullName: 'Efua Owusu', relationship: 'Mother', email: 'efua@example.com' }],
      })

      expect(prismaMock.guardian.create).not.toHaveBeenCalled()
      expect(prismaMock.pupilGuardian.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ guardianId: 'g-9' }) }),
      )
    })

    it('rejects a duplicate pupil ID', async () => {
      prismaMock.pupil.findUnique.mockResolvedValue(pupilRecord())

      await expect(createPupil(owner, { ...createInput, pupilId: 'PRPS-PUP-0001' })).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
        message: expect.stringMatching(/already in use/),
      })
    })

    it('rejects a duplicate admission number', async () => {
      prismaMock.pupil.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) =>
        where.admissionNumber ? pupilRecord() : null,
      )

      await expect(createPupil(owner, { ...createInput, admissionNumber: 'ADM-2026-001' })).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
        message: expect.stringMatching(/already in use/),
      })
    })

    it('rejects an invalid class reference', async () => {
      prismaMock.schoolClass.findUnique.mockResolvedValue(null)

      await expect(createPupil(owner, { ...createInput, classId: 'missing' })).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
      })
    })

    it('never persists or returns password-like data', async () => {
      prismaMock.pupil.create.mockResolvedValue({ id: 'p-1' })

      const result = await createPupil(owner, createInput)

      expect(JSON.stringify(result)).not.toContain('password')
      expect(JSON.stringify(result)).not.toContain('token')
    })
  })

  describe('updatePupil', () => {
    it('updates editable fields and audits the change', async () => {
      await updatePupil(owner, 'p-1', { firstName: 'Ama', lastName: 'Asante', address: 'Tema' })

      expect(prismaMock.pupil.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: expect.objectContaining({ firstName: 'Ama', lastName: 'Asante', address: 'Tema' }),
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'pupil.update',
            metadata: expect.objectContaining({ changed: expect.arrayContaining(['firstName', 'address']) }),
          }),
        }),
      )
    })

    it('connects a new class and records the class assignment change', async () => {
      await updatePupil(owner, 'p-1', { classId: 'class-2' })

      expect(prismaMock.pupil.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { class: { connect: { id: 'class-2' } } },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'pupil.update',
            metadata: expect.objectContaining({ changed: expect.arrayContaining(['class']) }),
          }),
        }),
      )
    })

    it('rejects a pupil ID collision during update', async () => {
      prismaMock.pupil.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) => {
        if (where.id === 'p-1') return pupilRecord()
        if (where.pupilId) return pupilRecord('other')
        return null
      })

      await expect(updatePupil(owner, 'p-1', { pupilId: 'PRPS-PUP-0001' })).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
      })
    })

    it('rejects an admission number collision during update', async () => {
      prismaMock.pupil.findUnique.mockImplementation(async ({ where }: { where: Record<string, string> }) => {
        if (where.id === 'p-1') return pupilRecord()
        if (where.admissionNumber) return pupilRecord('other')
        return null
      })

      await expect(updatePupil(owner, 'p-1', { admissionNumber: 'ADM-2026-001' })).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
      })
    })

    it('syncs the guardian set when guardians are provided', async () => {
      await updatePupil(owner, 'p-1', {
        guardians: [{ fullName: 'Efua Owusu', relationship: 'Mother', isPrimary: true }],
      })

      expect(prismaMock.pupilGuardian.deleteMany).toHaveBeenCalledWith({ where: { pupilId: 'p-1' } })
      expect(prismaMock.pupilGuardian.create).toHaveBeenCalledTimes(1)
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({ changed: expect.arrayContaining(['guardians']) }),
          }),
        }),
      )
    })

    it('throws a 404 for a missing pupil', async () => {
      await expect(updatePupil(owner, 'missing', { firstName: 'Ama' })).rejects.toMatchObject({
        statusCode: HttpStatus.NotFound,
      })
    })
  })

  describe('setPupilStatus', () => {
    it('deactivates a pupil, preserves the record and audits the action', async () => {
      await setPupilStatus(headteacher, 'p-1', 'INACTIVE')

      expect(prismaMock.pupil.update).toHaveBeenCalledWith({
        where: { id: 'p-1' },
        data: { status: 'INACTIVE' },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'pupil.deactivate' }) }),
      )
    })

    it('activates a deactivated pupil', async () => {
      prismaMock.pupil.findUnique.mockResolvedValue(pupilRecord('p-1', { status: 'INACTIVE' }))

      await setPupilStatus(headteacher, 'p-1', 'ACTIVE')

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'pupil.activate' }) }),
      )
    })

    it('is a no-op when the status does not change', async () => {
      await setPupilStatus(headteacher, 'p-1', 'ACTIVE')

      expect(prismaMock.pupil.update).not.toHaveBeenCalled()
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
    })

    it('throws a 404 for a missing pupil', async () => {
      await expect(setPupilStatus(headteacher, 'missing', 'INACTIVE')).rejects.toMatchObject({
        statusCode: HttpStatus.NotFound,
      })
    })
  })

  describe('getPupilStats', () => {
    it('aggregates totals and a per-class breakdown', async () => {
      prismaMock.pupil.count.mockImplementation(
        async ({ where }: { where?: { status?: string } } = {}) =>
          where?.status === 'ACTIVE' ? 8 : where?.status === 'INACTIVE' ? 2 : 10,
      )
      prismaMock.pupil.groupBy.mockResolvedValue([
        { classId: 'class-1', _count: { _all: 6 } },
        { classId: 'class-2', _count: { _all: 4 } },
      ])
      prismaMock.schoolClass.findMany.mockResolvedValue([
        { id: 'class-1', name: 'Primary 1' },
        { id: 'class-2', name: 'Primary 2' },
      ])

      const stats = await getPupilStats()

      expect(stats.total).toBe(10)
      expect(stats.active).toBe(8)
      expect(stats.inactive).toBe(2)
      expect(stats.byClass).toEqual([
        { classId: 'class-1', className: 'Primary 1', count: 6 },
        { classId: 'class-2', className: 'Primary 2', count: 4 },
      ])
    })
  })
})