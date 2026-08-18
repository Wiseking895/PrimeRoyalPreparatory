import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'
import { OWNER_ROLE } from '../rbac/catalog'
import { createOwner, ownerExists } from './setup.service'

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  role: {
    findUnique: vi.fn(),
  },
  userRole: {
    create: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
  permission: { upsert: vi.fn() },
  rolePermission: { count: vi.fn(), createMany: vi.fn() },
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../lib/password', () => ({ hashPassword: vi.fn().mockResolvedValue('hashed') }))
vi.mock('./ensure-rbac', () => ({ ensureInitialRbac: vi.fn().mockResolvedValue(undefined) }))

describe('setup.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (fn: (tx: typeof prismaMock) => unknown) => fn(prismaMock))
    prismaMock.auditLog.create.mockResolvedValue({})
  })

  describe('ownerExists', () => {
    it('returns true when an owner exists', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'owner-1' })
      await expect(ownerExists()).resolves.toBe(true)
    })

    it('returns false when no owner exists', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      await expect(ownerExists()).resolves.toBe(false)
    })
  })

  describe('createOwner', () => {
    const input = {
      fullName: ' Ada Lovelace ',
      email: 'ADA@SCHOOL.EDU',
      password: 'secret123',
    }

    it('creates the first Owner with the OWNER role', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-owner', name: OWNER_ROLE })
      prismaMock.user.create.mockResolvedValue({
        id: 'owner-1',
        fullName: 'Ada Lovelace',
        email: 'ada@school.edu',
        phone: null,
        profilePictureUrl: null,
        status: 'ACTIVE',
        lastLoginAt: null,
        mustChangePassword: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })

      const result = await createOwner(input)

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          fullName: 'Ada Lovelace',
          email: 'ada@school.edu',
          phone: null,
          passwordHash: 'hashed',
        },
      })
      expect(prismaMock.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'owner-1', roleId: 'role-owner' },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'owner.initial_setup' }) }),
      )
      expect(result.roles).toContain(OWNER_ROLE)
    })

    it('rejects a second Owner with a conflict', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'existing-owner' })

      await expect(createOwner(input)).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
        message: expect.stringMatching(/already been completed/),
      })
      expect(prismaMock.user.create).not.toHaveBeenCalled()
    })

    it('rejects an email already in use', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue({ id: 'someone', email: 'ada@school.edu' })

      await expect(createOwner(input)).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
        message: expect.stringMatching(/already exists/),
      })
    })

    it('trims the phone number and full name', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-owner', name: OWNER_ROLE })
      prismaMock.user.create.mockResolvedValue({
        id: 'owner-1',
        fullName: 'Ada Lovelace',
        email: 'ada@school.edu',
        phone: '+233 20 000 0000',
        profilePictureUrl: null,
        status: 'ACTIVE',
        lastLoginAt: null,
        mustChangePassword: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })

      await createOwner({ ...input, phone: ' +233 20 000 0000 ' })

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          fullName: 'Ada Lovelace',
          email: 'ada@school.edu',
          phone: '+233 20 000 0000',
          passwordHash: 'hashed',
        },
      })
    })
  })
})