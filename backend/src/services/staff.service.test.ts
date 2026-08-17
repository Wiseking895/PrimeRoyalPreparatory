import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HttpStatus } from '../config/enums'
import { HEADTEACHER_ROLE, OWNER_ROLE } from '../rbac/catalog'
import type { AuthenticatedUser } from '../types/auth'
import {
  assignRole,
  createStaff,
  getStaff,
  listStaff,
  removeRole,
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
    create: vi.fn(),
    update: vi.fn(),
  },
  role: { findUnique: vi.fn() },
  userRole: { create: vi.fn(), deleteMany: vi.fn() },
  auditLog: { create: vi.fn() },
  $transaction: vi.fn(),
  permission: { upsert: vi.fn() },
  rolePermission: { count: vi.fn(), createMany: vi.fn() },
}))

vi.mock('../lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('../lib/password', () => ({ hashPassword: vi.fn().mockResolvedValue('hashed') }))

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
    fullName: 'Grace Hopper',
    email: 'grace@school.edu',
    phone: null,
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: null,
    staffProfile: {
      staffId: 'PRPS-STF-0001',
      category: 'NON_TEACHING',
      address: 'Accra',
      dateJoined: now,
      responsibilities: null,
      createdAt: now,
    },
    roles: [
      {
        role: {
          id: 'role-nonteaching',
          name: 'NON_TEACHING_STAFF',
          rolePermissions: [],
        },
      },
    ],
  }
}

describe('staff.service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.auditLog.create.mockResolvedValue({})
    prismaMock.user.update.mockResolvedValue({})
    prismaMock.staffProfile.update.mockResolvedValue({})
    prismaMock.userRole.deleteMany.mockResolvedValue({ count: 0 })
    prismaMock.userRole.create.mockResolvedValue({})
    prismaMock.$transaction.mockImplementation((arg: unknown) => {
      if (typeof arg === 'function') return arg(prismaMock)
      return Promise.resolve(arg)
    })
    prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === 'st-1' ? staffRecord() : null,
    )
    prismaMock.user.findMany.mockResolvedValue([staffRecord()])
  })

  describe('listStaff', () => {
    it('returns staff views', async () => {
      const list = await listStaff()

      expect(list).toHaveLength(1)
      expect(list[0]).toMatchObject({ staffId: 'PRPS-STF-0001', category: 'NON_TEACHING' })
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
      password: 'secret123',
    }

    it('creates a staff member with the default role', async () => {
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-nonteaching', name: 'NON_TEACHING_STAFF', rolePermissions: [] })
      prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.email) return null
        if (where.id === 'st-1') return staffRecord()
        return null
      })
      prismaMock.staffProfile.count.mockResolvedValue(0)
      prismaMock.user.create.mockResolvedValue({ id: 'st-1' })

      const result = await createStaff(owner, input)

      expect(prismaMock.userRole.create).toHaveBeenCalledWith({
        data: { userId: 'st-1', roleId: 'role-nonteaching' },
      })
      expect(prismaMock.staffProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ staffId: 'PRPS-STF-0001', category: 'NON_TEACHING' }),
        }),
      )
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ action: 'staff.create' }) }),
      )
      expect(result.staffId).toBe('PRPS-STF-0001')
    })

    it('uses the TEACHING category for teaching roles', async () => {
      prismaMock.role.findUnique.mockResolvedValue({ id: 'role-ct', name: 'CLASS_TEACHER', rolePermissions: [] })
      prismaMock.user.findUnique.mockImplementation(async ({ where }: { where: { id?: string; email?: string } }) => {
        if (where.email) return null
        if (where.id === 'st-1') return staffRecord()
        return null
      })
      prismaMock.staffProfile.count.mockResolvedValue(0)
      prismaMock.user.create.mockResolvedValue({ id: 'st-1' })

      await createStaff(owner, { ...input, roleName: 'CLASS_TEACHER' })

      expect(prismaMock.staffProfile.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ category: 'TEACHING' }) }),
      )
    })

    it('rejects assigning a forbidden role', async () => {
      await expect(createStaff(owner, { ...input, roleName: HEADTEACHER_ROLE })).rejects.toMatchObject({
        statusCode: HttpStatus.Forbidden,
      })
    })

    it('rejects a Headteacher assigning a role that exceeds their authority', async () => {
      prismaMock.role.findUnique.mockResolvedValue({
        id: 'role-assistant',
        name: 'ASSISTANT_HEADTEACHER',
        rolePermissions: [{ permission: { key: 'pupils.manage' } }],
      })

      await expect(
        createStaff(headteacher, { ...input, roleName: 'ASSISTANT_HEADTEACHER' }),
      ).rejects.toMatchObject({
        statusCode: HttpStatus.Forbidden,
        message: expect.stringMatching(/exceeding your own authority/),
      })
    })
  })

  describe('updateStaff', () => {
    it('updates user and profile data', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ ...staffRecord(), roles: [] })

      await updateStaff(owner, 'st-1', {
        firstName: 'Katherine',
        lastName: 'Johnson',
        phone: '+233 20 000 0002',
        category: 'TEACHING',
        address: 'Tema',
        responsibilities: 'Maths lead',
      })

      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: 'st-1' },
        data: expect.objectContaining({ fullName: 'Katherine Johnson', phone: '+233 20 000 0002' }),
      })
      expect(prismaMock.staffProfile.update).toHaveBeenCalledWith({
        where: { userId: 'st-1' },
        data: { category: 'TEACHING', address: 'Tema', responsibilities: 'Maths lead' },
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