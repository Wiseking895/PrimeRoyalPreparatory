import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'
import { OWNER_ROLE } from '../rbac/catalog'
import { DEVELOPER_EMAIL } from './developer.service'
import { createOwner, createOwnerFromGoogle, ownerExists } from './setup.service'

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
  $queryRaw: vi.fn(),
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

    it('excludes the permanent developer account from the owner check', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      await expect(ownerExists()).resolves.toBe(false)
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith({
        where: {
          roles: { some: { role: { name: OWNER_ROLE } } },
          email: { not: DEVELOPER_EMAIL },
        },
      })
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

    it('takes the advisory lock before looking for an existing Owner', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'existing-owner' })

      await expect(
        createOwner({ fullName: 'Ada Lovelace', email: 'ada@school.edu', password: 'secret123' }),
      ).rejects.toMatchObject({ statusCode: HttpStatus.Conflict })

      expect(prismaMock.$queryRaw).toHaveBeenCalledTimes(1)
      const [template] = prismaMock.$queryRaw.mock.calls[0] as [TemplateStringsArray]
      expect(template.join('')).toContain('pg_advisory_xact_lock')
      expect(prismaMock.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
        prismaMock.user.findFirst.mock.invocationCallOrder[0],
      )
    })

    it('leaves no trace of a failed registration (no audit, no session side effects)', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-owner', name: OWNER_ROLE })
      prismaMock.user.create.mockResolvedValue({ id: 'owner-1', email: 'ada@school.edu' })
      // Role assignment fails inside the transaction: Prisma rolls the whole
      // thing back, and nothing outside the transaction may have run yet.
      prismaMock.userRole.create.mockRejectedValueOnce(new Error('role assignment failed'))

      await expect(createOwner(input)).rejects.toThrow('role assignment failed')

      expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
    })

    it('creates exactly one Owner when two first-time registrations race', async () => {
      // Emulates `pg_advisory_xact_lock`: transaction bodies run strictly one
      // after the other, which is what Postgres guarantees in production. The
      // check-and-create pair must live inside that critical section, otherwise
      // both requests would observe "no Owner yet" and both would insert one.
      let queue: Promise<unknown> = Promise.resolve()
      prismaMock.$transaction.mockImplementation((fn: (tx: typeof prismaMock) => unknown) => {
        const run = queue.then(() => fn(prismaMock))
        queue = run.catch(() => undefined)
        return run
      })

      let storedOwner: { id: string } | null = null
      prismaMock.user.findFirst.mockImplementation(async () => storedOwner)
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-owner', name: OWNER_ROLE })
      prismaMock.user.create.mockImplementation(async ({ data }: { data: { fullName: string; email: string } }) => {
        storedOwner = { id: 'owner-race' }
        return {
          id: 'owner-race',
          fullName: data.fullName,
          email: data.email,
          phone: null,
          profilePictureUrl: null,
          status: 'ACTIVE',
          lastLoginAt: null,
          mustChangePassword: false,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        }
      })

      const results = await Promise.allSettled([
        createOwner({ fullName: 'Ada Lovelace', email: 'ada@example.com', password: 'secret123' }),
        createOwner({ fullName: 'Grace Hopper', email: 'grace@example.com', password: 'secret123' }),
      ])

      const fulfilled = results.filter((result) => result.status === 'fulfilled')
      const rejected = results.filter((result): result is PromiseRejectedResult => result.status === 'rejected')

      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)
      expect(rejected[0].reason).toMatchObject({
        statusCode: HttpStatus.Conflict,
        message: expect.stringMatching(/already been completed/),
      })
      expect(prismaMock.user.create).toHaveBeenCalledTimes(1)
      expect(prismaMock.userRole.create).toHaveBeenCalledTimes(1)
      expect(prismaMock.auditLog.create).toHaveBeenCalledTimes(1)
    })
  })

  describe('createOwnerFromGoogle', () => {
    const profile = { googleId: 'g-123', email: 'ADA@GMAIL.COM', fullName: ' Ada Lovelace ' }

    beforeEach(() => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue(null)
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-owner', name: OWNER_ROLE })
      prismaMock.user.create.mockResolvedValue({
        id: 'owner-1',
        fullName: 'Ada Lovelace',
        email: 'ada@gmail.com',
        phone: null,
        profilePictureUrl: null,
        status: 'ACTIVE',
        lastLoginAt: null,
        mustChangePassword: false,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      })
    })

    it('provisions the first Owner from the verified Google identity', async () => {
      const result = await createOwnerFromGoogle(profile, '127.0.0.1')

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          fullName: 'Ada Lovelace',
          email: 'ada@gmail.com',
          phone: null,
          passwordHash: 'hashed',
        },
      })
      expect(prismaMock.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'owner-1', roleId: 'role-owner' },
      })
      expect(result.roles).toContain(OWNER_ROLE)
      expect(result.email).toBe('ada@gmail.com')
    })

    it('records the Google sign-up in the audit trail', async () => {
      await createOwnerFromGoogle(profile)

      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'owner.initial_setup_google',
            metadata: { provider: 'google', googleId: 'g-123' },
          }),
        }),
      )
    })

    it('never creates a second Owner when one already exists', async () => {
      prismaMock.user.findFirst.mockResolvedValue({ id: 'existing-owner' })

      await expect(createOwnerFromGoogle(profile)).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
        message: expect.stringMatching(/already been completed/),
      })
      expect(prismaMock.user.create).not.toHaveBeenCalled()
    })

    it('refuses an email already in use', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'someone', email: 'ada@gmail.com' })

      await expect(createOwnerFromGoogle(profile)).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
        message: expect.stringMatching(/already exists/),
      })
      expect(prismaMock.user.create).not.toHaveBeenCalled()
    })
  })
})