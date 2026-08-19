import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'
import { HEADTEACHER_ROLE, OWNER_ROLE } from '../rbac/catalog'
import type { AuthenticatedUser } from '../types/auth'
import {
  assignRole,
  createStaff,
  getStaff,
  getStaffStats,
  listStaff,
  removeRole,
  resendStaffInvitation,
  setStaffStatus,
  updateStaff,
} from './staff.service'

const prismaMock = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  staffProfile: {
    count: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  role: { findUnique: vi.fn() },
  userRole: { create: vi.fn(), deleteMany: vi.fn() },
  auditLog: { create: vi.fn(), findMany: vi.fn() },
  $transaction: vi.fn(),
  permission: { upsert: vi.fn() },
  rolePermission: { count: vi.fn(), createMany: vi.fn() },
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../lib/password', () => ({ hashPassword: vi.fn().mockResolvedValue('hashed-temp') }))

const mailMock = vi.hoisted(() => ({
  maskEmail: (email: string) => email,
  sendStaffInvitation: vi.fn(),
}))

vi.mock('./mail.service', () => mailMock)

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
  permissionKeys: ['staff.view', 'staff.create', 'staff.assign_role'],
}

function staffRecord(id = 'st-1') {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id,
    fullName: 'Katherine Johnson',
    email: 'katherine@school.edu',
    phone: null,
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: null,
    mustChangePassword: false,
    createdAt: now,
    staffProfile: {
      staffId: 'PRPS-STF-0001',
      category: 'NON_TEACHING',
      position: 'CLEANER',
      address: 'Accra',
      dateJoined: now,
      responsibilities: null,
      createdAt: now,
    },
    roles: [
      {
        role: {
          id: 'role-support',
          name: 'SUPPORT_STAFF',
          rolePermissions: [],
        },
      },
    ],
  }
}

function setupUserLookup() {
  prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
    if (where.email) return null
    if (where.id === 'st-1') return staffRecord()
    return null
  })
}

describe('staff.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.auditLog.findMany.mockResolvedValue([])
    prismaMock.user.update.mockResolvedValue({})
    prismaMock.staffProfile.update.mockResolvedValue({})
    prismaMock.staffProfile.count.mockResolvedValue(0)
    prismaMock.staffProfile.findUnique.mockResolvedValue(null)
    prismaMock.userRole.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.userRole.create.mockResolvedValue({})
    prismaMock.user.create.mockResolvedValue({ id: 'st-1' })
    prismaMock.$transaction.mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') return arg(prismaMock)
      return Promise.resolve(arg)
    })
    prismaMock.user.findMany.mockResolvedValue([staffRecord()])
    mailMock.sendStaffInvitation.mockResolvedValue({ status: 'sent', transport: 'smtp', messageId: 'm1' })
    setupUserLookup()
  })

  describe('listStaff', () => {
    it('returns staff views', async () => {
      const list = await listStaff()

      expect(list).toHaveLength(1)
      expect(list[0]).toMatchObject({ staffId: 'PRPS-STF-0001', category: 'NON_TEACHING', position: 'CLEANER' })
    })

    it('excludes the Owner and Headteacher from the manageable staff list', async () => {
      await listStaff()

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roles: { none: { role: { name: { in: [OWNER_ROLE, HEADTEACHER_ROLE] } } } },
          }),
        }),
      )
    })

    it('applies category, position and status filters', async () => {
      await listStaff({ category: 'TEACHING', position: 'CLASS_TEACHER', status: 'ACTIVE' })

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            staffProfile: { is: { category: 'TEACHING', position: 'CLASS_TEACHER' } },
            status: 'ACTIVE',
          }),
        }),
      )
    })
  })

  describe('getStaff', () => {
    it('returns a staff view for a staff account', async () => {
      const result = await getStaff('st-1')
      expect(result.id).toBe('st-1')
    })

    it('throws a 404 for a missing staff account', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...staffRecord(), staffProfile: null })
      await expect(getStaff('st-1')).rejects.toMatchObject({ statusCode: HttpStatus.NotFound })
    })
  })

  describe('createStaff', () => {
    const input = {
      firstName: ' Katherine ',
      lastName: ' Johnson ',
      email: 'KATHERINE@SCHOOL.EDU',
      position: 'CLEANER',
    }

    it('creates a staff member from a position with the derived role and category', async () => {
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-support', name: 'SUPPORT_STAFF', rolePermissions: [] })

      const result = await createStaff(owner, input)

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          fullName: 'Katherine Johnson',
          email: 'katherine@school.edu',
          passwordHash: 'hashed-temp',
          mustChangePassword: true,
          status: 'ACTIVE',
        }),
      })
      expect(prismaMock.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'st-1', roleId: 'role-support' },
      })
      expect(prismaMock.staffProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            staffId: 'PRPS-STF-0001',
            category: 'NON_TEACHING',
            position: 'CLEANER',
          }),
        }),
      )
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'staff.create' }) }),
      )
      expect(result.staff.staffId).toBe('PRPS-STF-0001')
      expect(result.invitation.status).toBe('sent')
    })

    it('maps a teaching position to the TEACHING category and CLASS_TEACHER role', async () => {
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-ct', name: 'CLASS_TEACHER', rolePermissions: [] })

      await createStaff(owner, { ...input, position: 'CLASS_TEACHER' })

      expect(prismaMock.staffProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ category: 'TEACHING', position: 'CLASS_TEACHER' }) }),
      )
      expect(prismaMock.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'st-1', roleId: 'role-ct' },
      })
    })

    it('sends the invitation email with the temporary password and position', async () => {
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-support', name: 'SUPPORT_STAFF', rolePermissions: [] })

      const result = await createStaff(owner, input)

      expect(mailMock.sendStaffInvitation).toHaveBeenCalledWith({
        to: 'katherine@school.edu',
        fullName: 'Katherine Johnson',
        staffId: 'PRPS-STF-0001',
        temporaryPassword: expect.any(String),
        position: 'Cleaner',
      })
      expect(result.invitation).toMatchObject({ status: 'sent' })
    })

    it('rejects an unknown position', async () => {
      await expect(createStaff(owner, { ...input, position: 'NINJA' })).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
      })
    })

    it('rejects a duplicate email', async () => {
      prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) =>
        where.email ? { id: 'other' } : null,
      )

      await expect(createStaff(owner, input)).rejects.toMatchObject({
        statusCode: HttpStatus.Conflict,
        message: expect.stringMatching(/already exists/),
      })
    })

    it('rejects a Headteacher without assign_role creating an elevated position', async () => {
      const restricted: AuthenticatedUser = { ...headteacher, permissionKeys: ['staff.view', 'staff.create'] }

      await expect(createStaff(restricted, { ...input, position: 'ASSISTANT_HEADTEACHER' })).rejects.toMatchObject({
        statusCode: HttpStatus.Forbidden,
      })
    })

    it('rejects a Headteacher creating a position whose role exceeds their authority', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-assistant',
        name: 'ASSISTANT_HEADTEACHER',
        rolePermissions: [{ permission: { key: 'pupils.manage' } }],
      })

      await expect(createStaff(headteacher, { ...input, position: 'ASSISTANT_HEADTEACHER' })).rejects.toMatchObject({
        statusCode: HttpStatus.Forbidden,
        message: expect.stringMatching(/exceeding your own authority/),
      })
    })

    it('never returns or persists the temporary password', async () => {
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-support', name: 'SUPPORT_STAFF', rolePermissions: [] })

      const result = await createStaff(owner, input)

      expect(prismaMock.user.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({ password: expect.anything() }),
      })
      expect(JSON.stringify(result)).not.toContain('temporaryPassword')
      expect(JSON.stringify(result)).not.toContain('hashed-temp')
    })

    it('generates a collision-safe staff ID', async () => {
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-support', name: 'SUPPORT_STAFF', rolePermissions: [] })
      prismaMock.staffProfile.count.mockResolvedValue(3)
      prismaMock.staffProfile.findUnique.mockResolvedValueOnce({ staffId: 'PRPS-STF-0004' }).mockResolvedValueOnce(null)

      await createStaff(owner, input)

      expect(prismaMock.staffProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ staffId: 'PRPS-STF-0005' }) }),
      )
    })
  })

  describe('updateStaff', () => {
    it('updates user and profile data', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...staffRecord(), roles: [] })

      await updateStaff(owner, 'st-1', {
        firstName: 'Katherine',
        lastName: 'Johnson',
        phone: '+233 20 000 0002',
        address: 'Tema',
        responsibilities: 'Cleaning lead',
      })

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'st-1' },
        data: expect.objectContaining({ fullName: 'Katherine Johnson', phone: '+233 20 000 0002' }),
      })
      expect(prismaMock.staffProfile.update).toHaveBeenCalledWith({
        where: { userId: 'st-1' },
        data: { address: 'Tema', responsibilities: 'Cleaning lead' },
      })
    })

    it('reassigns the system role and category when the position changes', async () => {
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-ct', name: 'CLASS_TEACHER', rolePermissions: [] })

      await updateStaff(owner, 'st-1', { position: 'CLASS_TEACHER' })

      expect(prismaMock.staffProfile.update).toHaveBeenCalledWith({
        where: { userId: 'st-1' },
        data: expect.objectContaining({ position: 'CLASS_TEACHER', category: 'TEACHING' }),
      })
      expect(prismaMock.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'st-1' } })
      expect(prismaMock.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'st-1', roleId: 'role-ct' },
      })
    })

    it('rejects an invalid position', async () => {
      await expect(updateStaff(owner, 'st-1', { position: 'NINJA' })).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
      })
    })

    it('throws a 404 for a missing staff account', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null)
      await expect(updateStaff(owner, 'missing', { firstName: 'X' })).rejects.toMatchObject({
        statusCode: HttpStatus.NotFound,
      })
    })
  })

  describe('setStaffStatus', () => {
    it('deactivates a staff member', async () => {
      const result = await setStaffStatus(owner, 'st-1', 'INACTIVE')

      expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: 'st-1' }, data: { status: 'INACTIVE' } })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'staff.deactivate' }) }),
      )
      expect(result).toBeDefined()
    })

    it('prevents deactivating your own account', async () => {
      prismaMock.user.findUnique.mockResolvedValue(staffRecord('owner-1'))

      await expect(setStaffStatus(owner, 'owner-1', 'INACTIVE')).rejects.toMatchObject({
        statusCode: HttpStatus.BadRequest,
      })
    })
  })

  describe('resendStaffInvitation', () => {
    it('rotates the password, forces a change and sends a fresh invitation', async () => {
      const result = await resendStaffInvitation(owner, 'st-1')

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'st-1' },
        data: expect.objectContaining({ passwordHash: 'hashed-temp', mustChangePassword: true }),
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'staff.invitation.resend' }) }),
      )
      expect(mailMock.sendStaffInvitation).toHaveBeenCalledWith(
        expect.objectContaining({ staffId: 'PRPS-STF-0001', position: 'Cleaner' }),
      )
      expect(result.invitation.status).toBe('sent')
      expect(result.staff.id).toBe('st-1')
    })

    it('throws a 404 for a missing staff account', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...staffRecord(), staffProfile: null })
      await expect(resendStaffInvitation(owner, 'st-1')).rejects.toMatchObject({
        statusCode: HttpStatus.NotFound,
      })
    })
  })

  describe('getStaffStats', () => {
    it('computes totals by category, status and position', async () => {
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'a', status: 'ACTIVE', staffProfile: { category: 'TEACHING', position: 'CLASS_TEACHER' } },
        { id: 'b', status: 'ACTIVE', staffProfile: { category: 'NON_TEACHING', position: 'CLEANER' } },
        { id: 'c', status: 'INACTIVE', staffProfile: { category: 'NON_TEACHING', position: 'CLEANER' } },
      ])

      const stats = await getStaffStats()

      expect(stats).toEqual({
        total: 3,
        teaching: 1,
        nonTeaching: 2,
        active: 2,
        inactive: 1,
        byPosition: { CLASS_TEACHER: 1, CLEANER: 2 },
        recentActivity: [],
      })
    })

    it('excludes the Owner and Headteacher from the totals', async () => {
      await getStaffStats()

      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            roles: { none: { role: { name: { in: [OWNER_ROLE, HEADTEACHER_ROLE] } } } },
          }),
        }),
      )
    })
  })

  describe('assignRole', () => {
    it('reassigns the staff role', async () => {
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-ct', name: 'CLASS_TEACHER', rolePermissions: [] })

      const result = await assignRole(owner, 'st-1', 'CLASS_TEACHER')

      expect(prismaMock.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'st-1' } })
      expect(prismaMock.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'st-1', roleId: 'role-ct' },
      })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'staff.assign_role' }) }),
      )
      expect(result).toBeDefined()
    })

    it('rejects a role assignment that exceeds authority', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-assistant',
        name: 'ASSISTANT_HEADTEACHER',
        rolePermissions: [{ permission: { key: 'pupils.manage' } }],
      })

      await expect(assignRole(headteacher, 'st-1', 'ASSISTANT_HEADTEACHER')).rejects.toMatchObject({
        statusCode: HttpStatus.Forbidden,
      })
    })

    it('rejects assigning the Owner or Headteacher role', async () => {
      await expect(assignRole(owner, 'st-1', OWNER_ROLE)).rejects.toMatchObject({
        statusCode: HttpStatus.Forbidden,
      })
      await expect(assignRole(owner, 'st-1', HEADTEACHER_ROLE)).rejects.toMatchObject({
        statusCode: HttpStatus.Forbidden,
      })
    })
  })

  describe('removeRole', () => {
    it('removes all roles from a staff member', async () => {
      const result = await removeRole(owner, 'st-1')

      expect(prismaMock.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'st-1' } })
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'staff.remove_role' }) }),
      )
      expect(result).toBeDefined()
    })
  })
})