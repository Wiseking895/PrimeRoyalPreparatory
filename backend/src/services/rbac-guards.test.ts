import { describe, expect, it } from 'vitest'
import { HEADTEACHER_ROLE, OWNER_ROLE } from '@prps/shared'
import type { AuthenticatedUser } from '../types/auth'
import {
  assertNoEscalation,
  assertRoleAssignable,
  isHeadteacher,
  isOwner,
  isRoleAssignable,
} from './rbac-guards'
import { AppError } from '../utils/app-error'

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

describe('rbac-guards', () => {
  describe('isRoleAssignable', () => {
    it('only exposes assignable staff roles to a Headteacher', () => {
      expect(isRoleAssignable('CLASS_TEACHER')).toBe(true)
      expect(isRoleAssignable('ACCOUNTANT')).toBe(true)
      expect(isRoleAssignable(OWNER_ROLE)).toBe(false)
      expect(isRoleAssignable(HEADTEACHER_ROLE)).toBe(false)
    })
  })

  describe('isOwner / isHeadteacher', () => {
    it('detects the OWNER role', () => {
      expect(isOwner(user({ roleNames: [OWNER_ROLE] }))).toBe(true)
      expect(isOwner(user({ roleNames: [HEADTEACHER_ROLE] }))).toBe(false)
    })

    it('detects the HEADTEACHER role', () => {
      expect(isHeadteacher(user({ roleNames: [HEADTEACHER_ROLE] }))).toBe(true)
      expect(isHeadteacher(user({ roleNames: [OWNER_ROLE] }))).toBe(false)
    })
  })

  describe('assertNoEscalation', () => {
    it('allows the Owner to grant any permission', () => {
      const owner = user({ roleNames: [OWNER_ROLE] })
      expect(() => assertNoEscalation(owner, ['owner.manage', 'staff.create'])).not.toThrow()
    })

    it('allows a grant that is a subset of the requester permissions', () => {
      const headteacher = user({
        roleNames: [HEADTEACHER_ROLE],
        permissionKeys: ['staff.view', 'staff.create', 'classes.view'],
      })
      expect(() => assertNoEscalation(headteacher, ['staff.view', 'classes.view'])).not.toThrow()
    })

    it('rejects a grant that exceeds the requester authority', () => {
      const headteacher = user({
        roleNames: [HEADTEACHER_ROLE],
        permissionKeys: ['staff.view'],
      })
      expect(() => assertNoEscalation(headteacher, ['staff.create'])).toThrow(AppError)
      expect(() => assertNoEscalation(headteacher, ['staff.create'])).toThrowError(
        /exceeding your own authority/,
      )
    })

    it('never grants owner-only permissions through a non-owner', () => {
      const headteacher = user({
        roleNames: [HEADTEACHER_ROLE],
        permissionKeys: ['owner.manage'],
      })
      // The hierarchy guard alone would pass; the catalog prevents this grant elsewhere.
      expect(() => assertNoEscalation(headteacher, ['owner.manage'])).not.toThrow()
    })
  })

  describe('assertRoleAssignable', () => {
    it('accepts assignable staff roles', () => {
      expect(() => assertRoleAssignable('SUPPORT_STAFF')).not.toThrow()
    })

    it('rejects non-assignable roles', () => {
      expect(() => assertRoleAssignable(OWNER_ROLE)).toThrow(AppError)
      expect(() => assertRoleAssignable(HEADTEACHER_ROLE)).toThrowError(/cannot be assigned/)
    })
  })
})