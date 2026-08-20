import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AuthenticatedUser } from '../types/auth'
import {
  createParentAccount,
  listGuardians,
  resendParentInvitation,
  setParentAccountStatus,
} from './guardians.service'

const prismaMock = vi.hoisted(() => ({
  guardian: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn() },
}))

const passwordMock = vi.hoisted(() => ({ hashPassword: vi.fn() }))
const temporaryPasswordMock = vi.hoisted(() => ({ generateTemporaryPassword: vi.fn() }))
const mailMock = vi.hoisted(() => ({ sendGuardianInvitation: vi.fn(), maskEmail: vi.fn((email: string) => email.split('@')[0].slice(0, 1) + '***@' + email.split('@')[1]) }))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../lib/password', () => passwordMock)
vi.mock('../lib/temporary-password', () => temporaryPasswordMock)
vi.mock('./mail.service', () => mailMock)

function actor(overrides: Partial<AuthenticatedUser> = {}): AuthenticatedUser {
  return {
    id: 'user-1',
    fullName: 'Ama Mensah',
    email: 'ama@school.edu',
    phone: null,
    status: 'ACTIVE',
    staffId: 'STF-0001',
    roleNames: ['HEADTEACHER'],
    permissionKeys: ['guardians.view', 'guardians.manage'],
    ...overrides,
  }
}

function guardianRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guardian-1',
    fullName: 'Mrs. Efua Asante',
    email: 'efua@example.com',
    accountEmail: 'efua@example.com',
    phone: '0244000000',
    address: null,
    passwordHash: null,
    status: 'INACTIVE',
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    _count: { pupilGuardians: 2 },
    ...overrides,
  }
}

describe('guardians.service (Phase 7 — parent account administration)', () => {
  let storedGuardian: ReturnType<typeof guardianRow> = guardianRow()

  beforeEach(() => {
    vi.clearAllMocks()
    storedGuardian = guardianRow()
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.guardian.findUnique.mockImplementation(async ({ where }: { where: { id?: string; accountEmail?: string } }) => {
      if (where.accountEmail) return null
      return storedGuardian
    })
    prismaMock.guardian.update.mockImplementation(
      async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        storedGuardian = guardianRow({ id: where.id, ...data, accountEmail: data.accountEmail ?? 'efua@example.com' })
        return storedGuardian
      },
    )
    passwordMock.hashPassword.mockResolvedValue('$2b$12$hash')
    temporaryPasswordMock.generateTemporaryPassword.mockReturnValue('TEMP1234abcd')
    mailMock.sendGuardianInvitation.mockResolvedValue({ status: 'dev', transport: 'dev' })
  })

  describe('createParentAccount', () => {
    it('provisions an account, hashes the temp password and sends the invitation', async () => {
      const result = await createParentAccount(actor(), 'guardian-1', {}, '127.0.0.1')

      expect(temporaryPasswordMock.generateTemporaryPassword).toHaveBeenCalled()
      expect(passwordMock.hashPassword).toHaveBeenCalledWith('TEMP1234abcd')
      expect(prismaMock.guardian.update).toHaveBeenCalledWith({
        where: { id: 'guardian-1' },
        data: expect.objectContaining({
          accountEmail: 'efua@example.com',
          passwordHash: '$2b$12$hash',
          status: 'ACTIVE',
          mustChangePassword: true,
          createdByUserId: 'user-1',
        }),
      })
      expect(mailMock.sendGuardianInvitation).toHaveBeenCalledWith({
        to: 'efua@example.com',
        fullName: 'Mrs. Efua Asante',
        temporaryPassword: 'TEMP1234abcd',
      })
      expect(result.invitation.status).toBe('dev')
      expect(result.guardian.hasAccount).toBe(true)
      expect(result.guardian.accountEmail).toBe('efua@example.com')
      expect(prismaMock.auditLog.create).toHaveBeenCalled()
    })

    it('does not leak the temporary password or hash into the response or audit', async () => {
      const result = await createParentAccount(actor(), 'guardian-1')
      const serialized = JSON.stringify(result)
      expect(serialized).not.toContain('TEMP1234abcd')
      expect(serialized).not.toContain('$2b$12$hash')

      const auditArg = prismaMock.auditLog.create.mock.calls[0][0]
      expect(JSON.stringify(auditArg)).not.toContain('TEMP1234abcd')
      expect(JSON.stringify(auditArg)).not.toContain('efua@example.com')
    })

    it('rejects a guardian with no email address', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow({ email: null, accountEmail: null }))
      await expect(createParentAccount(actor(), 'guardian-1')).rejects.toThrow('email address is required')
      expect(prismaMock.guardian.update).not.toHaveBeenCalled()
    })

    it('rejects when the account email is already used by another guardian', async () => {
      prismaMock.guardian.findUnique.mockImplementation(async ({ where }: { where: { id?: string; accountEmail?: string } }) => {
        if (where.accountEmail) return guardianRow({ id: 'guardian-2', passwordHash: '$2b$12$x', status: 'ACTIVE' })
        return guardianRow()
      })
      await expect(createParentAccount(actor(), 'guardian-1', { accountEmail: 'other@example.com' })).rejects.toThrow(
        'already exists',
      )
    })

    it('rejects when the guardian already has an active account', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(
        guardianRow({ passwordHash: '$2b$12$x', status: 'ACTIVE' }),
      )
      await expect(createParentAccount(actor(), 'guardian-1')).rejects.toThrow('already has an active parent account')
    })
  })

  describe('resendParentInvitation', () => {
    it('regenerates credentials and re-sends the invitation', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(
        guardianRow({ passwordHash: '$2b$12$old', status: 'ACTIVE' }),
      )
      temporaryPasswordMock.generateTemporaryPassword.mockReturnValue('RESEND1234xy')
      await resendParentInvitation(actor(), 'guardian-1')

      expect(prismaMock.guardian.update).toHaveBeenCalledWith({
        where: { id: 'guardian-1' },
        data: expect.objectContaining({ passwordHash: '$2b$12$hash', mustChangePassword: true, status: 'ACTIVE' }),
      })
      expect(mailMock.sendGuardianInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ temporaryPassword: 'RESEND1234xy' }),
      )
    })

    it('rejects when the guardian has no account yet', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow())
      await expect(resendParentInvitation(actor(), 'guardian-1')).rejects.toThrow('does not have a parent account')
    })
  })

  describe('setParentAccountStatus', () => {
    it('deactivates an active account', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(
        guardianRow({ passwordHash: '$2b$12$x', status: 'ACTIVE' }),
      )
      await setParentAccountStatus(actor(), 'guardian-1', 'INACTIVE')
      expect(prismaMock.guardian.update).toHaveBeenCalledWith({
        where: { id: 'guardian-1' },
        data: { status: 'INACTIVE' },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalled()
    })

    it('rejects status changes for a guardian without an account', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow())
      await expect(setParentAccountStatus(actor(), 'guardian-1', 'INACTIVE')).rejects.toThrow(
        'does not have a parent account',
      )
    })
  })

  describe('listGuardians', () => {
    it('lists guardians and never exposes password hashes', async () => {
      prismaMock.guardian.findMany.mockResolvedValue([
        guardianRow(),
        guardianRow({ id: 'guardian-2', fullName: 'Mr. Kofi Asante', passwordHash: '$2b$12$hash', status: 'ACTIVE', accountEmail: 'kofi@example.com' }),
      ])
      prismaMock.guardian.count.mockResolvedValue(2)
      const result = await listGuardians({ account: 'has_account' })

      expect(result.total).toBe(2)
      expect(result.items[1]).toMatchObject({ hasAccount: true, accountStatus: 'ACTIVE', accountEmail: 'kofi@example.com' })
      expect(JSON.stringify(result)).not.toContain('$2b$12$hash')
    })
  })
})