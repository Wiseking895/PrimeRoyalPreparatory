import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'
import { HEADTEACHER_ROLE, OWNER_ROLE } from '../rbac/catalog'
import type { UserRecord } from './user-mapper'
import { AppError } from '../utils/app-error'
import { changePassword, completeFirstPasswordChange, getUserProfile, login } from './auth.service'

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn() },
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))

const verifyPasswordMock = vi.hoisted(() => vi.fn())
const hashPasswordMock = vi.hoisted(() => vi.fn())
const signTokenMock = vi.hoisted(() => vi.fn())

vi.mock('../lib/password', () => ({
  verifyPassword: verifyPasswordMock,
  hashPassword: hashPasswordMock,
}))
vi.mock('../lib/jwt', () => ({ signToken: signTokenMock, verifyToken: vi.fn() }))

const NOW = new Date('2026-01-01T00:00:00.000Z')

function user(overrides: Partial<UserRecord> & { passwordHash?: string } = {}): UserRecord {
  return {
    id: 'user-1',
    fullName: 'Ada Lovelace',
    email: 'ada@school.edu',
    phone: null,
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: null,
    mustChangePassword: false,
    createdAt: NOW,
    staffProfile: null,
    roles: [],
    ...overrides,
    passwordHash: overrides.passwordHash ?? 'hash',
  } as UserRecord & { passwordHash: string }
}

function role(name: string, keys: string[] = []): UserRecord['roles'][number] {
  return {
    role: {
      name,
      rolePermissions: keys.map((key) => ({ permission: { key } })),
    },
  }
}

describe('auth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verifyPasswordMock.mockResolvedValue(false)
    hashPasswordMock.mockResolvedValue('hashed')
    signTokenMock.mockReturnValue('signed-token')
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({})
  })

  describe('login', () => {
    it('signs in an active Owner and records an audit entry', async () => {
      prismaMock.user.findFirst.mockResolvedValue(
        user({
          email: 'owner@school.edu',
          staffProfile: null,
          roles: [role(OWNER_ROLE)],
        }),
      )
      verifyPasswordMock.mockResolvedValue(true)

      const result = await login('OWNER@SCHOOL.EDU', 'secret123')

      expect(verifyPasswordMock).toHaveBeenCalledWith('secret123', expect.any(String))
      expect(prismaMock.user.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { OR: expect.arrayContaining([expect.any(Object)]) },
        }),
      )
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { lastLoginAt: expect.any(Date) },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'auth.login' }) }),
      )
      expect(result.token).toBe('signed-token')
      expect(result.user.roles).toContain(OWNER_ROLE)
    })

    it('signs in a Headteacher by staff ID', async () => {
      prismaMock.user.findFirst.mockResolvedValue(
        user({
          id: 'ht-1',
          fullName: 'Grace Hopper',
          email: 'grace@school.edu',
          staffProfile: {
            staffId: 'PRPS-HT-001',
            category: 'LEADERSHIP',
            position: null,
            address: null,
            dateJoined: new Date('2026-01-01T00:00:00.000Z'),
            responsibilities: null,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          roles: [role(HEADTEACHER_ROLE, ['staff.view'])],
        }),
      )
      verifyPasswordMock.mockResolvedValue(true)

      const result = await login('PRPS-HT-001', 'secret123')

      expect(result.user.staffId).toBe('PRPS-HT-001')
      expect(result.user.roles).toContain(HEADTEACHER_ROLE)
      expect(result.user.permissions).toContain('staff.view')
    })

    it('rejects invalid credentials', async () => {
      prismaMock.user.findFirst.mockResolvedValue(
        user({ email: 'ada@school.edu', roles: [role(OWNER_ROLE)] }),
      )
      verifyPasswordMock.mockResolvedValue(false)

      await expect(login('ada@school.edu', 'wrongpass1')).rejects.toThrowError(
        /Invalid email, staff ID, or password/,
      )
      await expect(login('ada@school.edu', 'wrongpass1')).rejects.toMatchObject({
        statusCode: HttpStatus.Unauthorized,
      })
      expect(prismaMock.auditLog.create).not.toHaveBeenCalled()
    })

    it('rejects a deactivated account', async () => {
      prismaMock.user.findFirst.mockResolvedValue(
        user({ email: 'ada@school.edu', status: 'INACTIVE', roles: [role(OWNER_ROLE)] }),
      )
      verifyPasswordMock.mockResolvedValue(true)

      const error = await login('ada@school.edu', 'secret123').catch((err) => err)
      expect(error).toBeInstanceOf(AppError)
      expect(error.statusCode).toBe(HttpStatus.Forbidden)
      expect(error.message).toMatch(/deactivated/)
    })
  })

  describe('getUserProfile', () => {
    it('returns the public profile for an existing user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(user({ id: 'user-1', roles: [role(OWNER_ROLE)] }))

      const profile = await getUserProfile('user-1')

      expect(profile.id).toBe('user-1')
      expect(profile.email).toBe('ada@school.edu')
      expect(profile.roles).toContain(OWNER_ROLE)
    })

    it('throws a structured 404 when the account is missing', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      await expect(getUserProfile('missing')).rejects.toMatchObject({
        statusCode: HttpStatus.NotFound,
      })
    })
  })

  describe('changePassword', () => {
    it('updates the password hash when the current password matches', async () => {
      prismaMock.user.findUnique.mockResolvedValue(user({ id: 'user-1' }))
      verifyPasswordMock.mockResolvedValue(true)

      await changePassword('user-1', 'oldpass1', 'newpass1')

      expect(hashPasswordMock).toHaveBeenCalledWith('newpass1')
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'hashed', mustChangePassword: false },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'auth.password_change' }) }),
      )
    })

    it('rejects a wrong current password', async () => {
      prismaMock.user.findUnique.mockResolvedValue(user({ id: 'user-1' }))
      verifyPasswordMock.mockResolvedValue(false)

      await expect(changePassword('user-1', 'wrong', 'newpass1')).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
      })
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('throws a 404 for a missing account', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      await expect(changePassword('missing', 'oldpass1', 'newpass1')).rejects.toMatchObject({
        statusCode: HttpStatus.NotFound,
      })
    })
  })

  describe('completeFirstPasswordChange', () => {
    it('sets a new password and clears the temporary-password flag', async () => {
      prismaMock.user.findUnique.mockResolvedValue(user({ id: 'user-1', mustChangePassword: true }))

      await completeFirstPasswordChange('user-1', 'brandnew1', '127.0.0.1')

      expect(hashPasswordMock).toHaveBeenCalledWith('brandnew1')
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { passwordHash: 'hashed', mustChangePassword: false },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'auth.first_password_change' }) }),
      )
    })

    it('rejects the change when the account is not flagged', async () => {
      prismaMock.user.findUnique.mockResolvedValue(user({ id: 'user-1', mustChangePassword: false }))

      await expect(completeFirstPasswordChange('user-1', 'brandnew1')).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
      })
      expect(prismaMock.user.update).not.toHaveBeenCalled()
    })

    it('throws a 404 for a missing account', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      await expect(completeFirstPasswordChange('missing', 'brandnew1')).rejects.toMatchObject({
        statusCode: HttpStatus.NotFound,
      })
    })
  })
})