import { describe, expect, it } from 'vitest'
import { HEADTEACHER_ROLE, OWNER_ROLE, PERMISSIONS, ROLE_DEFINITIONS } from '../rbac/catalog'
import type { AuthenticatedUser } from '../types/auth'
import { groupedPermissionsFor, listRolesFor } from './rbac-catalog'

function user(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 'user-1',
    fullName: 'Ada Lovelace',
    email: 'ada@example.com',
    phone: null,
    status: 'ACTIVE',
    staffId: 'P/0001',
    roleNames: [],
    permissionKeys: [],
    ...overrides,
  }
}

describe('rbac-catalog', () => {
  describe('listRolesFor', () => {
    it('lists the full catalog for the Owner', () => {
      const roles = listRolesFor(user({ roleNames: [OWNER_ROLE] }))
      expect(roles).toHaveLength(ROLE_DEFINITIONS.length)
      expect(roles.some(({ name }) => name === OWNER_ROLE)).toBe(true)
    })

    it('hides Owner and Headteacher from a Headteacher', () => {
      const roles = listRolesFor(user({ roleNames: [HEADTEACHER_ROLE] }))
      const names = roles.map(({ name }) => name)
      expect(names).not.toContain(OWNER_ROLE)
      expect(names).not.toContain(HEADTEACHER_ROLE)
      expect(names).toContain('CLASS_TEACHER')
      expect(names).toContain('ACCOUNTANT')
      expect(names).toContain('SUPPORT_STAFF')
    })
  })

  describe('groupedPermissionsFor', () => {
    it('groups every permission by module for the Owner', () => {
      const groups = groupedPermissionsFor(user({ roleNames: [OWNER_ROLE] }))
      const keys = groups.flatMap((group) => group.permissions.map(({ key }) => key))
      expect(keys).toHaveLength(PERMISSIONS.length)
      const ownerGroup = groups.find(({ module }) => module === 'owner')
      expect(ownerGroup).toBeDefined()
      expect(ownerGroup?.permissions.some(({ key }) => key === 'owner.manage')).toBe(true)
    })

    it('only exposes the Headteacher own permissions, grouped by module', () => {
      const requester = user({
        roleNames: [HEADTEACHER_ROLE],
        permissionKeys: ['staff.view', 'staff.create', 'classes.view'],
      })
      const groups = groupedPermissionsFor(requester)

      expect(groups.map(({ module }) => module)).toEqual(['staff', 'classes'])
      const staff = groups.find(({ module }) => module === 'staff')
      expect(staff?.permissions.map(({ key }) => key)).toEqual(['staff.view', 'staff.create'])
      const classes = groups.find(({ module }) => module === 'classes')
      expect(classes?.permissions.map(({ key }) => key)).toEqual(['classes.view'])
    })

    it('never exposes owner-only permissions to a non-owner', () => {
      const requester = user({
        roleNames: [HEADTEACHER_ROLE],
        // A defensive Headteacher who claims owner keys still must not see them.
        permissionKeys: [...PERMISSIONS.map(({ key }) => key)],
      })
      const keys = groupedPermissionsFor(requester).flatMap((group) =>
        group.permissions.map(({ key }) => key),
      )
      for (const ownerKey of ['owner.manage', 'owner.create', 'owner.change', 'owner.delete']) {
        expect(keys).not.toContain(ownerKey)
      }
    })

    it('returns an empty list for a Headteacher with no permissions', () => {
      const groups = groupedPermissionsFor(user({ roleNames: [HEADTEACHER_ROLE] }))
      expect(groups).toEqual([])
    })
  })
})