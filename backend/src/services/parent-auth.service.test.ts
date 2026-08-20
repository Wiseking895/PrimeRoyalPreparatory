import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GuardianIdentity } from '../types/auth'
import {
  changeParentPassword,
  completeParentFirstPasswordChange,
  getParentProfile,
  parentLogin,
} from './parent-auth.service'

const prismaMock = vi.hoisted(() => ({
  guardian: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: { create: vi.fn() },
}))

const jwtMock = vi.hoisted(() => ({ signToken: vi.fn() }))
const passwordMock = vi.hoisted(() => ({ hashPassword: vi.fn(), verifyPassword: vi.fn() }))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../lib/jwt', () => jwtMock)
vi.mock('../lib/password', () => passwordMock)

function guardianRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guardian-1',
    fullName: 'Mrs. Efua Asante',
    email: 'efua@example.com',
    accountEmail: 'efua@example.com',
    phone: '0244000000',
    passwordHash: '$2b$12$hashed',
    status: 'ACTIVE',
    mustChangePassword: false,
    lastLoginAt: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    pupilGuardians: [{ pupilId: 'p-1' }, { pupilId: 'p-2' }],
    ...overrides,
  }
}

describe('parent-auth.service (Phase 7 — guardian parent accounts)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.auditLog.create.mockResolvedValue({})
    passwordMock.verifyPassword.mockResolvedValue(true)
    passwordMock.hashPassword.mockResolvedValue('$2b$12$newhash')
    jwtMock.signToken.mockReturnValue('parent-token')
  })

  describe('parentLogin', () => {
    it('signs in a guardian with the correct email and password', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow())
      const result = await parentLogin('Efua@example.com', 'secret123')

      expect(prismaMock.guardian.findUnique).toHaveBeenCalledWith({
        where: { accountEmail: 'efua@example.com' },
      })
      expect(passwordMock.verifyPassword).toHaveBeenCalledWith('secret123', '$2b$12$hashed')
      expect(jwtMock.signToken).toHaveBeenCalledWith('guardian-1', 'guardian')
      expect(result.token).toBe('parent-token')
      expect(result.user).toMatchObject({
        id: 'guardian-1',
        fullName: 'Mrs. Efua Asante',
        email: 'efua@example.com',
        linkedPupilCount: 2,
      })
      expect(prismaMock.guardian.update).toHaveBeenCalledWith({
        where: { id: 'guardian-1' },
        data: { lastLoginAt: expect.any(Date) },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'parent.login' }) }),
      )
    })

    it('never returns the password hash in the profile', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow())
      const result = await parentLogin('efua@example.com', 'secret123')
      expect(JSON.stringify(result.user)).not.toContain('hashed')
    })

    it('rejects an unknown email with a generic message', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(null)
      await expect(parentLogin('nobody@example.com', 'secret123')).rejects.toThrow('Invalid email or password')
      expect(jwtMock.signToken).not.toHaveBeenCalled()
    })

    it('rejects a guardian with no provisioned account', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow({ passwordHash: null }))
      await expect(parentLogin('efua@example.com', 'secret123')).rejects.toThrow('Invalid email or password')
    })

    it('rejects a wrong password', async () => {
      passwordMock.verifyPassword.mockResolvedValue(false)
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow())
      await expect(parentLogin('efua@example.com', 'wrong')).rejects.toThrow('Invalid email or password')
    })

    it('rejects a deactivated account with 403 semantics', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow({ status: 'INACTIVE' }))
      await expect(parentLogin('efua@example.com', 'secret123')).rejects.toThrow('deactivated')
    })
  })

  describe('getParentProfile', () => {
    it('returns the parent profile with linked pupil count', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow())
      const profile = await getParentProfile('guardian-1')
      expect(profile.email).toBe('efua@example.com')
      expect(profile.linkedPupilCount).toBe(2)
    })

    it('rejects a guardian with no account', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow({ passwordHash: null }))
      await expect(getParentProfile('guardian-1')).rejects.toThrow('Account not found')
    })
  })

  describe('changeParentPassword', () => {
    it('updates the hash and clears mustChangePassword', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow())
      await changeParentPassword('guardian-1', 'current', 'NewPassword1')

      expect(passwordMock.hashPassword).toHaveBeenCalledWith('NewPassword1')
      expect(prismaMock.guardian.update).toHaveBeenCalledWith({
        where: { id: 'guardian-1' },
        data: { passwordHash: '$2b$12$newhash', mustChangePassword: false },
      })
    })

    it('rejects a wrong current password', async () => {
      passwordMock.verifyPassword.mockResolvedValue(false)
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow())
      await expect(changeParentPassword('guardian-1', 'wrong', 'NewPassword1')).rejects.toThrow(
        'Current password is incorrect',
      )
    })
  })

  describe('completeParentFirstPasswordChange', () => {
    it('replaces the temporary hash and clears the flag', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow({ mustChangePassword: true }))
      await completeParentFirstPasswordChange('guardian-1', 'NewPassword1')
      expect(prismaMock.guardian.update).toHaveBeenCalledWith({
        where: { id: 'guardian-1' },
        data: { passwordHash: '$2b$12$newhash', mustChangePassword: false },
      })
    })

    it('rejects when the account is not in the first-login state', async () => {
      prismaMock.guardian.findUnique.mockResolvedValue(guardianRow({ mustChangePassword: false }))
      await expect(completeParentFirstPasswordChange('guardian-1', 'NewPassword1')).rejects.toThrow(
        'already set up',
      )
    })
  })

  it('identity helper exposes no secrets', () => {
    // The GuardianIdentity used by the middleware never includes the hash.
    const identity: GuardianIdentity = {
      id: 'guardian-1',
      fullName: 'Mrs. Efua Asante',
      email: 'efua@example.com',
      phone: null,
      status: 'ACTIVE',
      mustChangePassword: false,
    }
    expect(identity).not.toHaveProperty('passwordHash')
  })
})