import { describe, expect, it } from 'vitest'
import { HEADTEACHER_ROLE, OWNER_ROLE } from '@prps/shared'
import {
  permissionKeysOf,
  roleNamesOf,
  toPublicUser,
  toStaffView,
  type UserRecord,
} from './user-mapper'

function record(overrides: Partial<UserRecord> = {}): UserRecord {
  const now = new Date('2026-01-01T00:00:00.000Z')
  return {
    id: 'user-1',
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: '+233 20 000 0000',
    profilePictureUrl: null,
    status: 'ACTIVE',
    lastLoginAt: now,
    staffProfile: {
      staffId: 'P/0001',
      category: 'TEACHING',
      address: 'Accra',
      dateJoined: now,
      responsibilities: null,
      createdAt: now,
    },
    roles: [],
    ...overrides,
  }
}

function role(name: string, keys: string[] = []): UserRecord['roles'][number] {
  return {
    role: {
      name,
      rolePermissions: keys.map((key) => ({ permission: { key } })),
    },
  }
}

describe('user-mapper', () => {
  describe('roleNamesOf', () => {
    it('returns role names in assignment order', () => {
      const user = record({ roles: [role(OWNER_ROLE), role(HEADTEACHER_ROLE)] })
      expect(roleNamesOf(user)).toEqual([OWNER_ROLE, HEADTEACHER_ROLE])
    })
  })

  describe('permissionKeysOf', () => {
    it('flattens permission keys across roles', () => {
      const user = record({
        roles: [
          role(HEADTEACHER_ROLE, ['staff.view', 'staff.create']),
          role('CLASS_TEACHER', ['classes.view']),
        ],
      })
      expect(permissionKeysOf(user)).toEqual(['staff.view', 'staff.create', 'classes.view'])
    })

    it('deduplicates shared permission keys', () => {
      const user = record({
        roles: [
          role('CLASS_TEACHER', ['classes.view']),
          role('SUBJECT_TEACHER', ['classes.view']),
        ],
      })
      expect(permissionKeysOf(user)).toEqual(['classes.view'])
    })

    it('returns an empty array when no roles are assigned', () => {
      expect(permissionKeysOf(record())).toEqual([])
    })
  })

  describe('toPublicUser', () => {
    it('maps roles, deduped permissions and the staff id', () => {
      const user = record({
        roles: [
          role(HEADTEACHER_ROLE, ['staff.view', 'classes.view']),
          role('CLASS_TEACHER', ['classes.view']),
        ],
      })

      expect(toPublicUser(user)).toEqual({
        id: 'user-1',
        fullName: 'Ada Lovelace',
        email: 'ada@example.com',
        phone: '+233 20 000 0000',
        profilePictureUrl: null,
        status: 'ACTIVE',
        lastLoginAt: '2026-01-01T00:00:00.000Z',
        staffId: 'P/0001',
        roles: [HEADTEACHER_ROLE, 'CLASS_TEACHER'],
        permissions: ['staff.view', 'classes.view'],
      })
    })

    it('handles users without a staff profile or last login', () => {
      const owner = record({
        staffProfile: null,
        lastLoginAt: null,
        roles: [role(OWNER_ROLE)],
      })

      const publicUser = toPublicUser(owner)
      expect(publicUser.staffId).toBeNull()
      expect(publicUser.lastLoginAt).toBeNull()
      expect(publicUser.roles).toEqual([OWNER_ROLE])
    })
  })

  describe('toStaffView', () => {
    it('includes staff profile fields', () => {
      const user = record({
        roles: [role('CLASS_TEACHER', ['classes.view'])],
      })

      expect(toStaffView(user)).toMatchObject({
        staffId: 'P/0001',
        category: 'TEACHING',
        address: 'Accra',
        dateJoined: '2026-01-01T00:00:00.000Z',
        responsibilities: null,
        roles: ['CLASS_TEACHER'],
        permissions: ['classes.view'],
      })
    })

    it('tolerates a missing staff profile', () => {
      const user = record({
        staffProfile: null,
        lastLoginAt: null,
        roles: [],
      })

      const view = toStaffView(user)
      expect(view.staffId).toBeNull()
      expect(view.category).toBeNull()
      expect(view.dateJoined).toBeNull()
      expect(view.responsibilities).toBeNull()
    })
  })
})