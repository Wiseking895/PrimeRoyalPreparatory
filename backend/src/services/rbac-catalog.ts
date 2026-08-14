import {
  ASSIGNABLE_STAFF_ROLES,
  OWNER_ONLY_PERMISSIONS,
  PERMISSIONS,
  ROLE_DEFINITIONS,
  type PermissionDefinition,
  type RoleDefinition,
} from '../rbac/catalog'
import type { AuthenticatedUser } from '../types/auth'
import { isOwner } from './rbac-guards'

/**
 * Read-only views of the role/permission catalog for management screens.
 * Sensitive roles (Owner, Headteacher) are never exposed to a Headteacher.
 */

export function listRolesFor(requester: AuthenticatedUser): RoleDefinition[] {
  if (isOwner(requester)) {
    return ROLE_DEFINITIONS
  }
  return ROLE_DEFINITIONS.filter((role) => ASSIGNABLE_STAFF_ROLES.includes(role.name))
}

export interface GroupedPermission {
  module: string
  moduleLabel: string
  permissions: Array<Pick<PermissionDefinition, 'key' | 'label' | 'description'>>
}

export function groupedPermissionsFor(requester: AuthenticatedUser): GroupedPermission[] {
  const visible = PERMISSIONS.filter((permission) => {
    if (isOwner(requester)) return true
    if ((OWNER_ONLY_PERMISSIONS as readonly string[]).includes(permission.key)) return false
    return requester.permissionKeys.includes(permission.key)
  })

  const groups = new Map<string, GroupedPermission>()
  for (const permission of visible) {
    const group = groups.get(permission.module) ?? {
      module: permission.module,
      moduleLabel: permission.moduleLabel,
      permissions: [],
    }
    group.permissions.push({
      key: permission.key,
      label: permission.label,
      description: permission.description,
    })
    groups.set(permission.module, group)
  }
  return Array.from(groups.values())
}