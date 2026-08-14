import { ASSIGNABLE_STAFF_ROLES, HEADTEACHER_ROLE, OWNER_ROLE } from '../rbac/catalog'
import type { AuthenticatedUser } from '../types/auth'
import { AppError } from '../utils/app-error'

/**
 * Role/permission hierarchy rules.
 *
 * OWNER → delegates authority to → HEADTEACHER → delegates appropriate
 * authority to → OTHER STAFF. A lower-level user can never grant authority
 * exceeding their own.
 */

/** Roles the Headteacher may assign (never Owner or another Headteacher). */
export function isRoleAssignable(roleName: string): boolean {
  return ASSIGNABLE_STAFF_ROLES.includes(roleName)
}

export function isOwner(requester: AuthenticatedUser): boolean {
  return requester.roleNames.includes(OWNER_ROLE)
}

export function isHeadteacher(requester: AuthenticatedUser): boolean {
  return requester.roleNames.includes(HEADTEACHER_ROLE)
}

/**
 * Throws unless `rolePermissions` is a subset of the requester's own
 * permission set (or the requester is the Owner).
 */
export function assertNoEscalation(
  requester: AuthenticatedUser,
  rolePermissions: string[],
): void {
  if (isOwner(requester)) return
  const unauthorized = rolePermissions.filter(
    (permission) => !requester.permissionKeys.includes(permission),
  )
  if (unauthorized.length > 0) {
    throw new AppError(
      'Forbidden: this role grants permissions exceeding your own authority.',
      403,
    )
  }
}

export function assertRoleAssignable(roleName: string): void {
  if (!isRoleAssignable(roleName)) {
    throw new AppError('Forbidden: this role cannot be assigned.', 403)
  }
}