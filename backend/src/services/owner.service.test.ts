import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'
import { logger } from '../config/logger'
import { HEADTEACHER_ROLE, OWNER_ROLE, OWNER_ONLY_PERMISSIONS } from '../rbac/catalog'
import type { AuthenticatedUser } from '../types/auth'
import {
  createHeadteacher,
  getHeadteacher,
  getOwnerSummary,
  listHeadteachers,
  resendHeadteacherInvitation,
  setHeadteacherPermissions,
  setHeadteacherStatus,
  updateHeadteacher,
} from './owner.service'

const prismaMock = vi.hoisted(() => ({
  user: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  staffProfile: {
    count: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
  role: { findUnique: vi.fn() },
  userRole: { create: vi.fn() },
  rolePermission: {
    deleteMany: vi.fn(),
    create: vi.fn(),
  },
  auditLog: { count: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
  permission: { upsert: vi.fn() },
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../lib/password', () => ({ hashPassword: vi.fn().mockResolvedValue('hashed') }))
vi.mock('./ensure-rbac', () => ({ ensureInitialRbac: vi.fn().mockResolvedValue(undefined) }))

const sendHeadteacherInvitationMock = vi.hoisted(() => vi.fn())
vi.mock('./mail.service', () => ({
  sendHeadteacherInvitation: sendHeadteacherInvitationMock,
  maskEmail: (email: string) => {
    const at = email.indexOf('@')
    return at <= 0 ? '***' : `${email.slice(0, 1)}***@${email.slice(at + 1)}`
  },
}))

const actor: AuthenticatedUser = {
  id: 'owner-1',
  fullName: 'Ada Lovelace',
  email: 'ada@school.edu',
  phone: null,
  status: 'ACTIVE',
  staffId: null,
  roleNames: [OWNER_ROLE],
  permissionKeys: [],
}

interface TestRole {
  role: {
    id: string
    name: string
    rolePermissions: Array<{ permission: { key: string } }>
  }
}

interface TestUser {
  id: string
  fullName: string
  email: string
  phone: string | null
  profilePictureUrl: string | null
  status: string
  lastLoginAt: Date | null
  mustChangePassword: boolean
  createdAt: Date
  staffProfile: {
    staffId: string
    category: string | null
    address: string | null
    dateJoined: Date
    responsibilities: string | null
    createdAt: Date
  } | null
  roles: TestRole[]
}

function headteacherRecord(overrides: Partial<TestUser> = {}): TestUser {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id: 'ht-1',
    fullName: 'Grace Hopper',
    email: 'grace@school.edu',
    phone: null,
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: null,
    mustChangePassword: false,
    createdAt: now,
    staffProfile: {
      staffId: 'PRPS-HT-001',
      category: 'LEADERSHIP',
      address: 'Accra',
      dateJoined: now,
      responsibilities: null,
      createdAt: now,
    },
    roles: [
      {
        role: {
          id: 'role-ht-id',
          name: HEADTEACHER_ROLE,
          rolePermissions: [{ permission: { key: 'staff.view' } }],
        },
      },
    ],
    ...overrides,
  }
}

function roleEntry(name: string, keys: string[]): TestRole {
  return {
    role: {
      id: `role-${name}`,
      name,
      rolePermissions: keys.map((key) => ({ permission: { key } })),
    },
  }
}

describe('owner.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.auditLog.findMany.mockResolvedValue([])
    prismaMock.user.update.mockResolvedValue({})
    prismaMock.user.count.mockResolvedValue(1)
    prismaMock.staffProfile.update.mockResolvedValue({})
    prismaMock.rolePermission.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.rolePermission.create.mockResolvedValue({})
    sendHeadteacherInvitationMock.mockResolvedValue({ status: 'dev', messageId: 'dev-1' })
    prismaMock.$transaction.mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') return arg(prismaMock)
      return Promise.resolve(arg)
    })
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'ht-1' ? headteacherRecord() : null,
    )
    prismaMock.user.findFirst.mockResolvedValue(null)
  })

  describe('getOwnerSummary', () => {
    it('aggregates headteacher, staff and audit counts', async () => {
      prismaMock.user.findFirst.mockResolvedValue(headteacherRecord())
      prismaMock.staffProfile.count.mockResolvedValue(3)
      prismaMock.auditLog.count.mockResolvedValue(7)

      const summary = await getOwnerSummary()

      expect(summary.headteacher?.staffId).toBe('PRPS-HT-001')
      expect(summary.totals.staff).toBe(3)
      expect(summary.totals.auditEntries).toBe(7)
    })
  })

  describe('listHeadteachers', () => {
    it('returns headteachers as staff views', async () => {
      prismaMock.user.findMany.mockResolvedValue([headteacherRecord()])

      const list = await listHeadteachers()

      expect(list).toHaveLength(1)
      expect(list[0]).toMatchObject({ staffId: 'PRPS-HT-001', category: 'LEADERSHIP' })
      expect(list[0].roles).toContain(HEADTEACHER_ROLE)
    })
  })

  describe('getHeadteacher', () => {
    it('returns a public user for a headteacher account', async () => {
      const result = await getHeadteacher('ht-1')
      expect(result.id).toBe('ht-1')
      expect(result.roles).toContain(HEADTEACHER_ROLE)
    })

    it('throws a 404 when the account is not a headteacher', async () => {
      prismaMock.user.findUnique.mockResolvedValue(headteacherRecord({ roles: [roleEntry('CLASS_TEACHER', [])] }))

      await expect(getHeadteacher('ht-1')).rejects.toMatchObject({
        statusCode: HttpStatus.NotFound,
      })
    })

    it('throws a 404 for a missing account', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)

      await expect(getHeadteacher('missing')).rejects.toMatchObject({
        statusCode: HttpStatus.NotFound,
      })
    })
  })

  describe('createHeadteacher', () => {
    const input = {
      firstName: ' Grace ',
      lastName: ' Hopper ',
      email: 'GRACE@SCHOOL.EDU',
    }

    it('creates a headteacher with a generated staff ID and marks it for password change', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.email) return null
        if (where.id === 'ht-1') return headteacherRecord({ mustChangePassword: true })
        return null
      })
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-ht', name: HEADTEACHER_ROLE })
      prismaMock.staffProfile.count.mockResolvedValue(0)
      prismaMock.user.create.mockResolvedValue({ id: 'ht-1' })

      const result = await createHeadteacher(actor, input)

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: {
          fullName: 'Grace Hopper',
          email: 'grace@school.edu',
          phone: null,
          passwordHash: 'hashed',
          mustChangePassword: true,
          status: 'ACTIVE',
        },
      })
      expect(prismaMock.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'ht-1', roleId: 'role-ht' },
      })
      expect(prismaMock.staffProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ staffId: 'PRPS-HT-001', category: 'LEADERSHIP' }) }),
      )
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'owner.headteacher.create' }) }),
      )
      expect(result.headteacher.roles).toContain(HEADTEACHER_ROLE)
      expect(result.headteacher.mustChangePassword).toBe(true)
    })

    it('sends the invitation email and reports the delivery result', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.email) return null
        if (where.id === 'ht-1') return headteacherRecord()
        return null
      })
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-ht', name: HEADTEACHER_ROLE })
      prismaMock.staffProfile.count.mockResolvedValue(0)
      prismaMock.user.create.mockResolvedValue({ id: 'ht-1' })
      sendHeadteacherInvitationMock.mockResolvedValue({ status: 'sent', messageId: 'm1' })

      const result = await createHeadteacher(actor, input)

      expect(sendHeadteacherInvitationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'grace@school.edu',
          fullName: 'Grace Hopper',
          staffId: 'PRPS-HT-001',
          temporaryPassword: expect.any(String),
        }),
      )
      expect(result.invitation).toMatchObject({ status: 'sent', messageId: 'm1' })
    })

    it('reports a failed invitation without failing the account creation', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.email) return null
        if (where.id === 'ht-1') return headteacherRecord()
        return null
      })
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-ht', name: HEADTEACHER_ROLE })
      prismaMock.staffProfile.count.mockResolvedValue(0)
      prismaMock.user.create.mockResolvedValue({ id: 'ht-1' })
      sendHeadteacherInvitationMock.mockResolvedValue({ status: 'failed', error: 'SMTP down' })

      const result = await createHeadteacher(actor, input)

      expect(result.invitation.status).toBe('failed')
      expect(result.headteacher.id).toBe('ht-1')
    })

    it('rejects creation while an active headteacher exists', async () => {
      prismaMock.user.findFirst.mockResolvedValue(headteacherRecord())

      await expect(createHeadteacher(actor, input)).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
        message: expect.stringMatching(/active Headteacher already exists/),
      })
    })

    it('rejects a duplicate email', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)
      prismaMock.user.findUnique.mockResolvedValue({ id: 'someone', email: 'grace@school.edu' })

      await expect(createHeadteacher(actor, input)).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
      })
    })
  })

  describe('resendHeadteacherInvitation', () => {
    it('generates a fresh temporary credential, re-arms the flag, and emails it', async () => {
      prismaMock.user.findUnique.mockResolvedValue(headteacherRecord())
      prismaMock.user.update.mockResolvedValue({})
      sendHeadteacherInvitationMock.mockResolvedValue({ status: 'sent', messageId: 'm2' })

      const result = await resendHeadteacherInvitation(actor, 'ht-1')

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'ht-1' },
        data: { passwordHash: 'hashed', mustChangePassword: true },
      })
      expect(sendHeadteacherInvitationMock).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'grace@school.edu',
          staffId: 'PRPS-HT-001',
          temporaryPassword: expect.any(String),
        }),
      )
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'owner.headteacher.invitation.resend' }) }),
      )
      expect(result.invitation).toMatchObject({ status: 'sent', messageId: 'm2' })
    })

    it('returns the refreshed account state with the forced-change flag set', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(headteacherRecord())
        .mockResolvedValueOnce(headteacherRecord({ mustChangePassword: true }))
      prismaMock.user.update.mockResolvedValue({})
      sendHeadteacherInvitationMock.mockResolvedValue({ status: 'queued', messageId: 'm3' })

      const result = await resendHeadteacherInvitation(actor, 'ht-1')

      expect(result.headteacher.mustChangePassword).toBe(true)
      expect(prismaMock.user.findUnique).toHaveBeenCalledTimes(2)
    })

    it('never creates a duplicate user, staff or role record on resend', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(headteacherRecord())
        .mockResolvedValueOnce(headteacherRecord({ mustChangePassword: true }))
      prismaMock.user.update.mockResolvedValue({})

      await resendHeadteacherInvitation(actor, 'ht-1')

      expect(prismaMock.user.create).not.toHaveBeenCalled()
      expect(prismaMock.staffProfile.create).not.toHaveBeenCalled()
      expect(prismaMock.userRole.create).not.toHaveBeenCalled()
      expect(prismaMock.user.update).toHaveBeenCalledTimes(1)
    })

    it('generates a brand-new temporary credential on each resend', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(headteacherRecord())
        .mockResolvedValueOnce(headteacherRecord({ mustChangePassword: true }))
      prismaMock.user.update.mockResolvedValue({})

      await resendHeadteacherInvitation(actor, 'ht-1')
      const first = (
        sendHeadteacherInvitationMock.mock.calls[0][0] as { temporaryPassword: string }
      ).temporaryPassword

      sendHeadteacherInvitationMock.mockClear()
      await resendHeadteacherInvitation(actor, 'ht-1')
      const second = (
        sendHeadteacherInvitationMock.mock.calls[0][0] as { temporaryPassword: string }
      ).temporaryPassword

      expect(first).not.toBe(second)
      expect(first.length).toBeGreaterThanOrEqual(8)
      expect(second.length).toBeGreaterThanOrEqual(8)
    })

    it('never includes the temporary password or hash in the API response', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(headteacherRecord())
        .mockResolvedValueOnce(headteacherRecord({ mustChangePassword: true }))
      prismaMock.user.update.mockResolvedValue({})

      const result = await resendHeadteacherInvitation(actor, 'ht-1')

      expect(result.headteacher).not.toHaveProperty('passwordHash')
      expect(result.headteacher).not.toHaveProperty('temporaryPassword')
      expect(result.headteacher).not.toHaveProperty('password')
      expect(JSON.stringify(result)).not.toContain('hashed')
    })

    it('logs the resend with a masked recipient and never logs the temporary password', async () => {
      prismaMock.user.findUnique
        .mockResolvedValueOnce(headteacherRecord())
        .mockResolvedValueOnce(headteacherRecord({ mustChangePassword: true }))
      prismaMock.user.update.mockResolvedValue({})
      sendHeadteacherInvitationMock.mockResolvedValue({ status: 'dev', messageId: 'dev-1' })

      const infoSpy = vi.spyOn(logger, 'info')
      let loggedPayloads: string[] = []
      try {
        await resendHeadteacherInvitation(actor, 'ht-1')
      } finally {
        loggedPayloads = infoSpy.mock.calls.map((call) => JSON.stringify(call))
        infoSpy.mockRestore()
      }

      const temporaryPassword = (
        sendHeadteacherInvitationMock.mock.calls[0][0] as { temporaryPassword: string }
      ).temporaryPassword

      expect(loggedPayloads.some((line) => line.includes(temporaryPassword))).toBe(false)
      expect(loggedPayloads.some((line) => line.includes('g***@school.edu'))).toBe(true)
      expect(loggedPayloads.some((line) => line.includes('PRPS-HT-001'))).toBe(true)
    })

    it('rejects resending for a non-headteacher account', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ id: 'staff-1', roles: [] })

      await expect(resendHeadteacherInvitation(actor, 'staff-1')).rejects.toMatchObject({
        statusCode: HttpStatus.NotFound,
      })
    })
  })

  describe('updateHeadteacher', () => {
    it('updates profile fields and records an audit entry', async () => {
      prismaMock.user.findUnique.mockResolvedValue(headteacherRecord())

      const result = await updateHeadteacher(actor, 'ht-1', {
        firstName: 'Grace',
        lastName: 'Hopper-Miller',
        phone: '+233 20 000 0001',
        address: 'Tema',
      })

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'ht-1' },
        data: expect.objectContaining({
          fullName: 'Grace Hopper-Miller',
          phone: '+233 20 000 0001',
        }),
      })
      expect(prismaMock.staffProfile.update).toHaveBeenCalledWith({
        where: { userId: 'ht-1' },
        data: { address: 'Tema' },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'owner.headteacher.update' }) }),
      )
      expect(result.roles).toContain(HEADTEACHER_ROLE)
    })

    it('rejects a duplicate email', async () => {
      prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) => {
        if (where.id === 'ht-1') return headteacherRecord()
        return { id: 'other', email: 'grace@school.edu' }
      })

      await expect(
        updateHeadteacher(actor, 'ht-1', { email: 'grace@school.edu' }),
      ).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
      })
    })
  })

  describe('setHeadteacherStatus', () => {
    it('deactivates a headteacher', async () => {
      const result = await setHeadteacherStatus(actor, 'ht-1', 'INACTIVE')

      expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'ht-1' }, data: { status: 'INACTIVE' } })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'owner.headteacher.deactivate' }) }),
      )
      expect(result).toBeDefined()
    })

    it('rejects activation while another headteacher is active', async () => {
      prismaMock.user.findFirst.mockResolvedValue(headteacherRecord({ id: 'ht-2' }))

      await expect(setHeadteacherStatus(actor, 'ht-1', 'ACTIVE')).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
      })
    })

    it('allows activation when no other headteacher is active', async () => {
      prismaMock.user.findFirst.mockResolvedValue(null)

      await setHeadteacherStatus(actor, 'ht-1', 'ACTIVE')

      expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'ht-1' }, data: { status: 'ACTIVE' } })
    })
  })

  describe('setHeadteacherPermissions', () => {
    it('replaces the role permission set', async () => {
      prismaMock.user.findUnique.mockResolvedValue(headteacherRecord())

      await setHeadteacherPermissions(actor, 'ht-1', ['staff.view', 'staff.create'])

      expect(prismaMock.rolePermission.deleteMany).toHaveBeenCalledWith({
        where: { roleId: 'role-ht-id' },
      })
      expect(prismaMock.rolePermission.create).toHaveBeenCalledWith({
        data: {
          role: { connect: { id: 'role-ht-id' } },
          permission: { connect: { key: 'staff.create' } },
        },
      })
    })

    it('never grants owner-only permissions and drops unknown keys', async () => {
      const ht = headteacherRecord({
        roles: [
          {
            role: {
              id: 'role-ht-id',
              name: HEADTEACHER_ROLE,
              rolePermissions: [],
            },
          },
        ],
      })
      prismaMock.user.findUnique.mockResolvedValue(ht)

      await setHeadteacherPermissions(actor, 'ht-1', [
        ...OWNER_ONLY_PERMISSIONS,
        'staff.view',
        'not-a-real-key',
      ])

      const createCalls = prismaMock.rolePermission.create.mock.calls.map((call) => call[0].data.permission.connect.key)
      expect(createCalls).toContain('staff.view')
      expect(createCalls).not.toContain('not-a-real-key')
      expect(createCalls).toEqual(expect.not.arrayContaining([...OWNER_ONLY_PERMISSIONS]))
    })

    it('throws a 404 for a non-headteacher account', async () => {
      prismaMock.user.findUnique.mockResolvedValue(headteacherRecord({ roles: [roleEntry('CLASS_TEACHER', [])] }))

      await expect(setHeadteacherPermissions(actor, 'ht-1', ['staff.view'])).rejects.toMatchObject({
        statusCode: HttpStatus.NotFound,
      })
    })
  })
})